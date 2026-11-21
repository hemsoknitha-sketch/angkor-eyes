import crypto from 'crypto';
import { db } from '../db/index.js';
import type { ActionType, ApprovalRequest } from '../db/schema.js';
import { config } from '../config/index.js';

export class ApprovalGate {
  /**
   * Classify whether an action is safe to run automatically or requires human approval.
   */
  public static classifyAction(actionType: ActionType, commandOrDetails?: string): {
    isRisky: boolean;
    reason: string;
  } {
    if (config.autoApprovalMode) {
      return { isRisky: false, reason: 'Auto-approval mode is globally enabled in config.' };
    }

    switch (actionType) {
      case 'git_push':
        return { isRisky: true, reason: 'Git push to remote repository modifies shared history.' };
      case 'merge_main':
        return { isRisky: true, reason: 'Merging code into main/production branch requires human approval.' };
      case 'delete_file':
        return { isRisky: true, reason: 'File deletion may cause irreversible data loss.' };
      case 'deploy':
        return { isRisky: true, reason: 'Deploying to staging or production triggers infrastructure changes.' };
      case 'custom_risky':
        return { isRisky: true, reason: `Potentially destructive command: ${commandOrDetails || 'Unclassified'}` };
      default:
        return { isRisky: false, reason: 'Read, local worktree edits, linting, and unit tests are safe.' };
    }
  }

  /**
   * Generates a tamper-proof SHA-256 hash for TOCTOU (Time-of-Check to Time-of-Use) validation.
   */
  public static computeActionHash(params: {
    actionType: ActionType;
    targetRepo: string;
    branchName: string;
    targetCommitSha: string;
    payloadSnippet: string;
  }): string {
    const raw = `${params.actionType}::${params.targetRepo}::${params.branchName}::${params.targetCommitSha}::${params.payloadSnippet}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Create an approval request with TOCTOU security.
   */
  public static createRequest(params: {
    roomId: string;
    agentId: string;
    taskId?: string;
    actionType: ActionType;
    summary: string;
    diffPayload?: string;
    targetRepo: string;
    branchName: string;
    targetCommitSha: string;
    expiresInMinutes?: number;
  }): ApprovalRequest {
    const actionHash = this.computeActionHash({
      actionType: params.actionType,
      targetRepo: params.targetRepo,
      branchName: params.branchName,
      targetCommitSha: params.targetCommitSha,
      payloadSnippet: (params.diffPayload || params.summary).substring(0, 500)
    });

    const expiresAt = new Date(Date.now() + (params.expiresInMinutes || 120) * 60 * 1000).toISOString();

    const request = db.createApprovalRequest({
      roomId: params.roomId,
      agentId: params.agentId,
      taskId: params.taskId,
      actionType: params.actionType,
      summary: params.summary,
      diffPayload: params.diffPayload,
      actionHash,
      targetRepo: params.targetRepo,
      branchName: params.branchName,
      targetCommitSha: params.targetCommitSha,
      expiresAt
    });

    db.addAuditLog('APPROVAL_REQUEST_CREATED', {
      approvalId: request.id,
      actionType: request.actionType,
      summary: request.summary,
      branchName: request.branchName,
      targetCommitSha: request.targetCommitSha,
      actionHash
    }, params.agentId);

    return request;
  }

  /**
   * Validates that the request has not been tampered with or branch modified before execution.
   */
  public static validateExecution(
    approvalId: string,
    currentCommitSha: string
  ): { valid: boolean; reason?: string } {
    const approval = db.getApprovalById(approvalId);
    if (!approval) {
      return { valid: false, reason: 'Approval request not found.' };
    }
    if (approval.status !== 'approved') {
      return { valid: false, reason: `Approval request is ${approval.status}, not approved.` };
    }
    if (new Date(approval.expiresAt).getTime() < Date.now()) {
      db.updateApproval(approvalId, { status: 'expired' });
      return { valid: false, reason: 'Approval has expired. Fresh approval is required.' };
    }
    // TOCTOU check: Target branch commit SHA must match what was approved!
    if (currentCommitSha && approval.targetCommitSha && currentCommitSha !== approval.targetCommitSha) {
      return {
        valid: false,
        reason: `TOCTOU Conflict: Target commit SHA changed from ${approval.targetCommitSha} to ${currentCommitSha}. Please re-approve.`
      };
    }

    return { valid: true };
  }

  /**
   * Approve a request.
   */
  public static approve(approvalId: string, approvedBy: string): ApprovalRequest | null {
    const approval = db.getApprovalById(approvalId);
    if (!approval || approval.status !== 'pending') return null;

    const updated = db.updateApproval(approvalId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString()
    });

    db.addAuditLog('APPROVAL_GRANTED', { approvalId, approvedBy }, approval.agentId);
    return updated;
  }

  /**
   * Reject a request.
   */
  public static reject(approvalId: string, rejectedBy: string, reason?: string): ApprovalRequest | null {
    const approval = db.getApprovalById(approvalId);
    if (!approval || approval.status !== 'pending') return null;

    const updated = db.updateApproval(approvalId, {
      status: 'rejected',
      rejectionReason: reason || 'Rejected by user',
      approvedBy: rejectedBy,
      approvedAt: new Date().toISOString()
    });

    db.addAuditLog('APPROVAL_REJECTED', { approvalId, rejectedBy, reason }, approval.agentId);
    return updated;
  }
}
