# Recipe Finder Authentication Setup

This guide walks you through adding login functionality to your Recipe Finder app.

## Overview

The authentication system includes:
- User registration and login
- Session management with tokens
- User statistics tracking
- Admin view to see all registered users
- Secure password hashing

## Architecture

- **DynamoDB Tables**: Store users and sessions
- **Lambda Function**: Handle auth operations (register, login, verify, logout)
- **Frontend**: Login/register forms and user management UI
- **API Gateway**: `/auth` endpoint for authentication

## Setup Steps

### 1. Create DynamoDB Tables

```bash
./create-tables.sh
```

This creates:
- `recipe-finder-users`: User accounts with email, name, password hash
- `recipe-finder-sessions`: Login sessions with expiration

### 2. Deploy Authentication Lambda

```bash
./deploy-auth.sh
```

This deploys the `recipe-finder-auth` Lambda function.

### 3. Update API Gateway

Add a new resource `/auth` to your existing API Gateway:

1. Go to API Gateway console
2. Select your Recipe Finder API
3. Create new resource: `/auth`
4. Add POST method
5. Set integration to Lambda function: `recipe-finder-auth`
6. Enable CORS
7. Deploy to your stage

### 4. Update Frontend Configuration

Update the API endpoint in `frontend/auth.js`:

```javascript
const AUTH_CONFIG = {
    API_ENDPOINT: 'https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod/auth',
    SESSION_KEY: 'recipe_finder_session'
};
```

### 5. Deploy Frontend

Upload the updated frontend files to your S3 bucket:
- `index.html` (updated to include auth.js)
- `auth.js` (new authentication logic)
- `app.js` (updated to work with authentication)
- `styles.css` (updated with auth styles)

## Features

### User Registration
- Email and password validation
- Secure password hashing with salt
- Automatic login after registration

### User Login
- Email/password authentication
- Session token generation (30-day expiration)
- Remember login state

### User Dashboard
- View personal stats (recipes generated, join date)
- Admin view to see all users
- Logout functionality

### Session Management
- Automatic session verification
- Token-based authentication
- Secure session cleanup on logout

## API Endpoints

### POST /auth

**Register User:**
```json
{
    "action": "register",
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
}
```

**Login:**
```json
{
    "action": "login",
    "email": "john@example.com",
    "password": "password123"
}
```

**Verify Session:**
```json
{
    "action": "verify_session",
    "session_token": "abc123..."
}
```

**Logout:**
```json
{
    "action": "logout",
    "session_token": "abc123..."
}
```

**Get All Users (Admin):**
```json
{
    "action": "get_users",
    "session_token": "abc123..."
}
```

## Security Features

- Passwords are hashed with SHA-256 + salt
- Session tokens are cryptographically secure
- Sessions expire after 30 days
- CORS protection
- Input validation and sanitization

## User Experience

1. **First Visit**: Users see login/register form
2. **Registration**: Simple form with name, email, password
3. **Login**: Email and password authentication
4. **Main App**: Full recipe finder functionality
5. **User Menu**: Access to stats and admin features
6. **Persistent Login**: Sessions remembered across visits

## Monitoring Users

Once deployed, you can:
- View all registered users through the admin panel
- See user statistics (join date, recipe count, last login)
- Track app usage and growth
- Monitor user engagement

## Cost Estimate

Additional costs for authentication:
- DynamoDB: ~$0.25/month per 1000 users (very low usage)
- Lambda: Minimal additional cost
- No additional S3 or API Gateway costs

## Troubleshooting

**Tables not found**: Run `./create-tables.sh` first
**Lambda errors**: Check CloudWatch logs for the `recipe-finder-auth` function
**CORS issues**: Ensure API Gateway has CORS enabled for the `/auth` endpoint
**Session issues**: Check that session tokens are being stored in localStorage

## Next Steps

After setup, you can enhance the system with:
- Password reset functionality
- Email verification
- User preferences storage
- Recipe favorites/history
- Social login (Google, Facebook)
- Admin role management