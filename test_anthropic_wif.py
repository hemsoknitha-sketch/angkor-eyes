import os
import sys

# Ensure static keys don't shadow WIF credentials
for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"):
    os.environ.pop(k, None)

try:
    import anthropic
    from anthropic import WorkloadIdentityCredentials
except ImportError:
    print("Anthropic SDK not installed. Run: pip install anthropic")
    sys.exit(1)


def fetch_github_oidc_token() -> str:
    # Set by the "Fetch GitHub OIDC token" step in .github/workflows/anthropic-wif-test.yml.
    token = os.environ.get("JWT")
    if not token:
        raise ValueError(
            "Environment variable 'JWT' is not set!\n"
            "This script uses Workload Identity Federation (WIF) and must be executed in GitHub Actions "
            "or an environment providing an OIDC token."
        )
    return token


def main():
    print("⚡ Connecting to Anthropic Claude via Workload Identity Federation (WIF)...")
    client = anthropic.Anthropic(
        credentials=WorkloadIdentityCredentials(
            identity_token_provider=fetch_github_oidc_token,
            federation_rule_id="fdrl_01NAw5JFXwpBLR6QwEkZwhrS",
            organization_id="fcaf9213-b3d4-4eb4-91f9-28a1dc2bd699",
            service_account_id="svac_01VoggjhGTh2HQvRQMGoqaCz",
            workspace_id="wrkspc_01M99mJJX7rRHrjFx7pAmt3s",
        ),
    )

    # Use supported model identifier (e.g. claude-3-7-sonnet-20250219 or claude-3-5-sonnet-latest)
    model_name = os.environ.get("CLAUDE_MODEL", "claude-3-7-sonnet-20250219")
    print(f"🤖 Invoking model: {model_name}...")

    message = client.messages.create(
        model=model_name,
        max_tokens=1024,
        messages=[{"role": "user", "content": "Hello, Claude"}],
    )
    
    reply = next(block.text for block in message.content if block.type == "text")
    print("--------------------------------------------------")
    print(f"✅ Anthropic Claude Response:\n{reply}")
    print("--------------------------------------------------")


if __name__ == "__main__":
    main()
