import { db } from '../db/index.js';

export class EmergencyKillSwitch {
  private static isEngaged = false;
  private static engagementReason = '';
  private static engagedAt = '';
  private static engagedBy = '';

  public static isKillSwitchEngaged(): boolean {
    return this.isEngaged;
  }

  public static getStatus(): { isEngaged: boolean; reason?: string; engagedAt?: string; engagedBy?: string } {
    return {
      isEngaged: this.isEngaged,
      reason: this.engagementReason,
      engagedAt: this.engagedAt,
      engagedBy: this.engagedBy
    };
  }

  /**
   * STOP ALL: Emergency shutdown of all running tasks, loops, and locks.
   */
  public static trigger(reason = 'Emergency stop triggered by Super Admin', triggeredBy = 'Super Admin'): {
    success: boolean;
    cancelledTasksCount: number;
    unlockedRoomsCount: number;
  } {
    this.isEngaged = true;
    this.engagementReason = reason;
    this.engagedAt = new Date().toISOString();
    this.engagedBy = triggeredBy;

    // 1. Cancel all in-flight tasks
    const tasks = db.getTasks();
    let cancelledTasksCount = 0;
    for (const t of tasks) {
      if (t.status === 'running' || t.status === 'pending') {
        db.updateTask(t.id, { status: 'cancelled' });
        cancelledTasksCount++;
      }
    }

    // 2. Unlock all rooms and clear turn queues
    const rooms = db.getRooms();
    let unlockedRoomsCount = 0;
    for (const r of rooms) {
      if (r.isLocked || r.activeTurnQueue.length > 0) {
        db.updateRoom(r.id, { isLocked: false, activeTurnQueue: [], currentSpeakerId: undefined });
        unlockedRoomsCount++;
      }
    }

    // 3. Log critical audit entry
    db.addAuditLog('KILL_SWITCH_ENGAGED', {
      reason,
      triggeredBy,
      cancelledTasksCount,
      unlockedRoomsCount
    });

    console.warn(`[KillSwitch] 🚨 EMERGENCY STOP ENGAGED by ${triggeredBy}. Cancelled ${cancelledTasksCount} tasks, unlocked ${unlockedRoomsCount} rooms.`);

    return {
      success: true,
      cancelledTasksCount,
      unlockedRoomsCount
    };
  }

  /**
   * Disengage and resume standard operations.
   */
  public static disengage(resumedBy = 'Super Admin'): boolean {
    this.isEngaged = false;
    this.engagementReason = '';
    this.engagedAt = '';
    this.engagedBy = '';

    db.addAuditLog('KILL_SWITCH_DISENGAGED', { resumedBy });
    console.log(`[KillSwitch] Kill switch disengaged by ${resumedBy}. Normal operations resumed.`);
    return true;
  }
}
