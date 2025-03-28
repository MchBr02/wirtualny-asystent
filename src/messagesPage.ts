// messagesPage.ts

/**
 * Returns the "Last 100 Messages" page
 */
// deno-lint-ignore no-explicit-any
export function renderMessagesPage(messages: any[], username: string): string {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${username}'s messages</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
      th { background-color: #f4f4f4; }
    </style>
  </head>
  <body>
    <h2>Last 100 Messages</h2>
    <table>
      <thead>
        <tr>
          <th>Message ID</th>
          <th>Timestamp</th>
          <th>Content</th>
          <th>Sender</th>
          <th>Receiver</th>
          <th>Platform</th>
        </tr>
      </thead>
      <tbody>
        ${messages.map(msg => `
          <tr>
            <td>${msg.message_id}</td>
            <td>${new Date(msg.timestamp).toLocaleString()}</td>
            <td>${msg.content}</td>
            <td>${msg.sender}</td>
            <td>${msg.receiver}</td>
            <td>${msg.platform}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <form action="/logout" method="POST">
      <button type="submit">Logout</button>
    </form>
  </body>
  </html>
    `;
}