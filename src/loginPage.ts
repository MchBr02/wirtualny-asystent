// loginPOage.ts

/**
 * Returns the login/register page
 */
export function renderLoginPage(): string {
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login / Register</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; }
      form { display: flex; flex-direction: column; max-width: 300px; margin: auto; }
      input, button { margin-top: 10px; padding: 10px; }
    </style>
  </head>
  <body>
    <h2>Login</h2>
    <form action="/login" method="POST">
      <input type="text" name="login" placeholder="Username" required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  
    <h2>Register</h2>
    <form action="/register" method="POST">
      <input type="text" name="login" placeholder="Username" required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit">Register</button>
    </form>
  </body>
  </html>
    `;
  }