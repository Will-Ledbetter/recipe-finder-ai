import json
import boto3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from decimal import Decimal

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
users_table = dynamodb.Table('recipe-finder-users')
sessions_table = dynamodb.Table('recipe-finder-sessions')

def lambda_handler(event, context):
    """
    User authentication and tracking - login required
    """
    try:
        print(f"Event: {json.dumps(event)}")
        body = json.loads(event.get('body', '{}'))
        print(f"Body: {body}")
        action = body.get('action')
        print(f"Action: {action}")
        
        if action == 'register':
            return handle_register(body)
        elif action == 'login':
            return handle_login(body)
        elif action == 'verify_session':
            return handle_verify_session(body)
        elif action == 'logout':
            return handle_logout(body)
        elif action == 'track_usage':
            return track_usage(body)
        elif action == 'get_stats':
            return get_stats(body)
        else:
            return error_response(400, "Invalid action")
            
    except Exception as e:
        print(f"Lambda handler error: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return error_response(500, f"Lambda error: {str(e)}")

def handle_register(body):
    """Handle user registration"""
    email = body.get('email', '').lower().strip()
    password = body.get('password', '')
    name = body.get('name', '').strip()
    
    if not email or not password or not name:
        return error_response(400, "Email, password, and name are required")
    
    if len(password) < 6:
        return error_response(400, "Password must be at least 6 characters")
    
    # Check if user exists
    try:
        response = users_table.get_item(Key={'email': email})
        if 'Item' in response:
            return error_response(409, "User already exists")
    except Exception as e:
        print(f"Error checking existing user: {e}")
        # Continue with registration even if check fails
    
    # Hash password
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    
    # Create user
    user_data = {
        'email': email,
        'name': name,
        'password_hash': password_hash,
        'salt': salt,
        'created_at': datetime.utcnow().isoformat(),
        'last_login': datetime.utcnow().isoformat(),
        'recipe_count': 0
    }
    
    try:
        users_table.put_item(Item=user_data)
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
        return error_response(500, "Failed to create user")

def handle_login(body):
    """Handle user login"""
    print("Starting handle_login")
    email = body.get('email', '').lower().strip()
    password = body.get('password', '')
    print(f"Login attempt for email: {email}")
    
    if not email or not password:
        print("Missing email or password")
        return error_response(400, "Email and password are required")
    
    try:
        print("Getting user from database")
        response = users_table.get_item(Key={'email': email})
        print(f"Database response: {response}")
        
        if 'Item' not in response:
            print("User not found")
            return error_response(401, "Invalid credentials")
        
        user = response['Item']
        print("User found, checking password")
        password_hash = hashlib.sha256((password + user['salt']).encode()).hexdigest()
        
        if password_hash != user['password_hash']:
            print("Password mismatch")
            return error_response(401, "Invalid credentials")
        
        print("Password correct, updating last login")
        # Update last login
        users_table.update_item(
            Key={'email': email},
            UpdateExpression='SET last_login = :timestamp',
            ExpressionAttributeValues={':timestamp': datetime.utcnow().isoformat()}
        )
        
        print("Creating session")
        session_token = create_session(email)
        
        print("Login successful")
        return success_response({
            'message': 'Login successful',
            'session_token': session_token,
            'user': {
                'email': user['email'],
                'name': user['name'],
                'recipe_count': user.get('recipe_count', 0)
            }
        })
    except Exception as e:
        print(f"Login error: {str(e)}")
        import traceback
        print(f"Login traceback: {traceback.format_exc()}")
        return error_response(500, f"Login failed: {str(e)}")

def handle_verify_session(body):
    """Verify session token"""
    session_token = body.get('session_token', '')
    
    if not session_token:
        return error_response(400, "Session token required")
    
    user_email = verify_session(session_token)
    if not user_email:
        return error_response(401, "Invalid or expired session")
    
    try:
        response = users_table.get_item(Key={'email': user_email})
        if 'Item' not in response:
            return error_response(401, "User not found")
        
        user = response['Item']
        return success_response({
            'valid': True,
            'user': {
                'email': user['email'],
                'name': user['name'],
                'recipe_count': user.get('recipe_count', 0)
            }
        })
    except Exception as e:
        return error_response(500, "Session verification failed")

def handle_logout(body):
    """Handle user logout"""
    session_token = body.get('session_token', '')
    
    if session_token:
        try:
            sessions_table.delete_item(Key={'session_token': session_token})
        except Exception as e:
            print(f"Error deleting session: {e}")
    
    return success_response({'message': 'Logged out successfully'})

def track_usage(body):
    """Track recipe generation - requires valid session"""
    session_token = body.get('session_token', '')
    
    if not session_token:
        return error_response(401, "Authentication required")
    
    user_email = verify_session(session_token)
    if not user_email:
        return error_response(401, "Invalid session")
    
    try:
        users_table.update_item(
            Key={'email': user_email},
            UpdateExpression='ADD recipe_count :inc SET last_used = :timestamp',
            ExpressionAttributeValues={
                ':inc': 1,
                ':timestamp': datetime.utcnow().isoformat()
            }
        )
        
        return success_response({'message': 'Usage tracked'})
    except Exception as e:
        return error_response(500, "Failed to track usage")

def get_stats(body):
    """Get usage statistics - requires authentication"""
    session_token = body.get('session_token', '')
    
    if not session_token:
        return error_response(401, "Authentication required")
    
    user_email = verify_session(session_token)
    if not user_email:
        return error_response(401, "Invalid session")
    
    try:
        response = users_table.scan()
        users = response.get('Items', [])
        
        total_users = len(users)
        total_recipes = sum(int(user.get('recipe_count', 0)) for user in users)
        
        users.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return success_response({
            'stats': {
                'total_users': total_users,
                'total_recipes_generated': total_recipes
            },
            'recent_users': users[:10]
        })
    except Exception as e:
        return error_response(500, "Failed to get stats")

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
            sessions_table.delete_item(Key={'session_token': session_token})
            return None
        
        return session['email']
    except Exception as e:
        return None

def decimal_to_int(obj):
    """Convert Decimal objects to int for JSON serialization"""
    if isinstance(obj, Decimal):
        return int(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_int(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_int(v) for v in obj]
    return obj

def success_response(data):
    """Return success response"""
    # Convert any Decimal objects to int
    clean_data = decimal_to_int(data)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        'body': json.dumps(clean_data)
    }

def error_response(status_code, message):
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