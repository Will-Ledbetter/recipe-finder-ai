import json
import boto3
import hashlib
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Initialize AWS services
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
users_table = dynamodb.Table('recipe-finder-users')
sessions_table = dynamodb.Table('recipe-finder-sessions')

def lambda_handler(event, context):
    """
    Main Lambda handler for user authentication
    """
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        if action == 'register':
            return handle_register(body)
        elif action == 'login':
            return handle_login(body)
        elif action == 'verify_session':
            return handle_verify_session(body)
        elif action == 'logout':
            return handle_logout(body)
        elif action == 'get_users':
            return handle_get_users(body)
        else:
            return error_response(400, "Invalid action")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(500, str(e))


def handle_register(body: Dict[str, Any]):
    """Handle user registration"""
    email = body.get('email', '').lower().strip()
    password = body.get('password', '')
    name = body.get('name', '').strip()
    
    # Validate input
    if not email or not password or not name:
        return error_response(400, "Email, password, and name are required")
    
    if len(password) < 6:
        return error_response(400, "Password must be at least 6 characters")
    
    # Check if user already exists
    try:
        response = users_table.get_item(Key={'email': email})
        if 'Item' in response:
            return error_response(409, "User already exists")
    except Exception as e:
        print(f"Error checking existing user: {e}")
        return error_response(500, "Database error")
    
    # Hash password
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    
    # Create user record
    user_data = {
        'email': email,
        'name': name,
        'password_hash': password_hash,
        'salt': salt,
        'created_at': datetime.utcnow().isoformat(),
        'last_login': None,
        'recipe_count': 0
    }
    
    try:
        users_table.put_item(Item=user_data)
        
        # Create session
        session_token = create_session(email)
        
        return success_response({
            'message': 'Registration successful',
            'session_token': session_token,
            'user': {
                'email': email,
                'name': name,
                'created_at': user_data['created_at']
            }
        })
        
    except Exception as e:
        print(f"Error creating user: {e}")
        return error_response(500, "Failed to create user")


def handle_login(body: Dict[str, Any]):
    """Handle user login"""
    email = body.get('email', '').lower().strip()
    password = body.get('password', '')
    
    if not email or not password:
        return error_response(400, "Email and password are required")
    
    try:
        # Get user from database
        response = users_table.get_item(Key={'email': email})
        if 'Item' not in response:
            return error_response(401, "Invalid credentials")
        
        user = response['Item']
        
        # Verify password
        password_hash = hashlib.sha256((password + user['salt']).encode()).hexdigest()
        if password_hash != user['password_hash']:
            return error_response(401, "Invalid credentials")
        
        # Update last login
        users_table.update_item(
            Key={'email': email},
            UpdateExpression='SET last_login = :timestamp',
            ExpressionAttributeValues={':timestamp': datetime.utcnow().isoformat()}
        )
        
        # Create session
        session_token = create_session(email)
        
        return success_response({
            'message': 'Login successful',
            'session_token': session_token,
            'user': {
                'email': user['email'],
                'name': user['name'],
                'created_at': user['created_at'],
                'recipe_count': user.get('recipe_count', 0)
            }
        })
        
    except Exception as e:
        print(f"Error during login: {e}")
        return error_response(500, "Login failed")


def handle_verify_session(body: Dict[str, Any]):
    """Verify session token"""
    session_token = body.get('session_token', '')
    
    if not session_token:
        return error_response(400, "Session token required")
    
    user_email = verify_session(session_token)
    if not user_email:
        return error_response(401, "Invalid or expired session")
    
    try:
        # Get user data
        response = users_table.get_item(Key={'email': user_email})
        if 'Item' not in response:
            return error_response(401, "User not found")
        
        user = response['Item']
        return success_response({
            'valid': True,
            'user': {
                'email': user['email'],
                'name': user['name'],
                'created_at': user['created_at'],
                'recipe_count': user.get('recipe_count', 0)
            }
        })
        
    except Exception as e:
        print(f"Error verifying session: {e}")
        return error_response(500, "Session verification failed")


def handle_logout(body: Dict[str, Any]):
    """Handle user logout"""
    session_token = body.get('session_token', '')
    
    if session_token:
        try:
            sessions_table.delete_item(Key={'session_token': session_token})
        except Exception as e:
            print(f"Error deleting session: {e}")
    
    return success_response({'message': 'Logged out successfully'})


def handle_get_users(body: Dict[str, Any]):
    """Get all users (admin function)"""
    # Verify admin session (you can add admin role checking here)
    session_token = body.get('session_token', '')
    user_email = verify_session(session_token)
    
    if not user_email:
        return error_response(401, "Authentication required")
    
    try:
        # Scan all users (for small datasets)
        response = users_table.scan(
            ProjectionExpression='email, #name, created_at, last_login, recipe_count',
            ExpressionAttributeNames={'#name': 'name'}
        )
        
        users = response.get('Items', [])
        
        # Sort by creation date
        users.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return success_response({
            'users': users,
            'total_count': len(users)
        })
        
    except Exception as e:
        print(f"Error getting users: {e}")
        return error_response(500, "Failed to retrieve users")


def create_session(email: str) -> str:
    """Create a new session token"""
    session_token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
    
    session_data = {
        'session_token': session_token,
        'email': email,
        'created_at': datetime.utcnow().isoformat(),
        'expires_at': expires_at
    }
    
    sessions_table.put_item(Item=session_data)
    return session_token


def verify_session(session_token: str) -> Optional[str]:
    """Verify session token and return user email if valid"""
    try:
        response = sessions_table.get_item(Key={'session_token': session_token})
        if 'Item' not in response:
            return None
        
        session = response['Item']
        expires_at = datetime.fromisoformat(session['expires_at'])
        
        if datetime.utcnow() > expires_at:
            # Session expired, delete it
            sessions_table.delete_item(Key={'session_token': session_token})
            return None
        
        return session['email']
        
    except Exception as e:
        print(f"Error verifying session: {e}")
        return None


def success_response(data: Dict[str, Any]):
    """Return success response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        'body': json.dumps(data)
    }


def error_response(status_code: int, message: str):
    """Return error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        'body': json.dumps({'error': message})
    }