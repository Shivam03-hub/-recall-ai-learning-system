"""
Sends transactional emails (welcome email, etc) via Resend.
"""

import os
import resend

resend.api_key = os.getenv("RESEND_API_KEY")


def send_welcome_email(to_email: str):
    try:
        resend.Emails.send({
            "from": "AI Learning Assistant <onboarding@resend.dev>",
            "to": to_email,
            "subject": "Welcome to your AI Learning Memory System 🎉",
            "html": """
                <h2>Welcome aboard!</h2>
                <p>Your account is ready. Start by uploading your first video or podcast,
                and we'll start building your personal knowledge library —
                tracking what you've learned, catching contradictions between sources,
                and flagging gaps before they become a problem.</p>
                <p>Happy learning!</p>
            """,
        })
        print(f"Welcome email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send welcome email to {to_email}: {e}")