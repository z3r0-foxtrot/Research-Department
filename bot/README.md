# Discord request bot

## Setup

1. Create a Discord application and bot, then enable **Server Members Intent** on the Bot page.
2. Invite it to the department server with `bot` and `applications.commands` scopes. It needs **View Channel** and **Send Messages** in the configured channels.
3. Copy `.env.example` to `.env`, then set the token and IDs.
4. Deploy this repository as a Node.js service in Wispbyte using build command `npm install` and start command `npm start`.

Commands: `/request-test`, `/submit-test-result`, and `/request-guard`.

`/submit-test-result` DMs every non-bot member who holds an ID in `APPROVER_ROLE_IDS`. Discord does not allow delivery to members who have DMs disabled; the acknowledgement reports delivery counts.
