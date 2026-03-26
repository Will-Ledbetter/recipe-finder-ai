import json
import base64
import boto3
import os
from typing import Dict, List, Any

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def lambda_handler(event, context):
    """
    Main Lambda handler for recipe finder
    """
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        images_data = body.get('images', [])  # Array of Base64 encoded images
        preferences = body.get('preferences', {})
        
        # Support legacy single image format
        if not images_data and body.get('image'):
            images_data = [body.get('image')]
        
        if not images_data:
            return error_response(400, "No images provided")
        
        # Remove data URL prefix if present
        cleaned_images = []
        for image_data in images_data:
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            cleaned_images.append(image_data)
        
        # Analyze images and get recipes
        ingredients = analyze_images(cleaned_images)
        recipes = generate_recipes(ingredients, preferences)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'ingredients': ingredients,
                'recipes': recipes
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(500, str(e))


def analyze_images(images_base64: List[str]) -> List[str]:
    """
    Use Bedrock Claude with vision to identify ingredients in multiple images
    """
    model_id = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0')
    
    # Build content array with all images
    content = []
    for idx, image_data in enumerate(images_base64):
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": image_data
            }
        })
    
    prompt = f"""Analyze these {len(images_base64)} image(s) of a fridge and/or pantry. List all food items and ingredients you can identify across ALL images.

GUIDELINES:
- List items you can see or reasonably identify from packaging/labels
- For packaged items, identify the product if you can read the label or recognize the packaging
- Be thorough but accurate - include items that are clearly visible
- If you can see part of an item or its packaging, include it if you're reasonably confident
- List specific items when possible (e.g., "cheddar cheese" rather than just "cheese")
- For produce, identify the specific fruit/vegetable if visible

Include:
- Fresh produce (fruits, vegetables)
- Proteins (meat, fish, eggs, tofu, etc.)
- Dairy products (milk, cheese, yogurt, butter, etc.)
- Condiments and sauces
- Grains and pasta
- Canned/packaged goods
- Beverages
- Bread and baked goods
- Spices and seasonings
- Frozen items (if visible)

Combine ingredients from all images into a single comprehensive list. Remove duplicates.

Format your response as a simple JSON array of ingredient names:
["ingredient1", "ingredient2", "ingredient3"]

Only return the JSON array, nothing else."""
    
    content.append({
        "type": "text",
        "text": prompt
    })

    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2000,
        "messages": [
            {
                "role": "user",
                "content": content
            }
        ]
    }
    
    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body)
    )
    
    response_body = json.loads(response['body'].read())
    content_text = response_body['content'][0]['text']
    
    # Parse JSON array from response
    try:
        ingredients = json.loads(content_text)
        return ingredients
    except:
        # Fallback: extract ingredients from text
        return [line.strip('- ').strip() for line in content_text.split('\n') if line.strip()]


def generate_recipes(ingredients: List[str], preferences: Dict[str, Any]) -> List[Dict]:
    """
    Generate recipe suggestions based on identified ingredients
    """
    model_id = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0')
    
    # Build preferences text
    pref_text = ""
    if preferences.get('dietary'):
        pref_text += f"\n- Dietary restrictions: {preferences['dietary']}"
    if preferences.get('cuisine'):
        pref_text += f"\n- Preferred cuisine: {preferences['cuisine']}"
    if preferences.get('cookingTime'):
        pref_text += f"\n- Max cooking time: {preferences['cookingTime']} minutes"
    if preferences.get('skillLevel'):
        pref_text += f"\n- Skill level: {preferences['skillLevel']}"
    
    prompt = f"""Based on these available ingredients:
{', '.join(ingredients)}

Preferences:{pref_text if pref_text else ' None'}

Suggest 3-5 realistic recipes that can be made PRIMARILY with these ingredients.

IMPORTANT RULES:
- Prioritize recipes that use MOST ingredients from the available list
- Keep "missingIngredients" to common pantry staples (salt, pepper, oil, flour, etc.)
- Don't suggest recipes that require many specialty ingredients not in the list
- Be practical and realistic about what can be made
- Consider ingredient combinations that actually work together

For each recipe, provide:
- name: Clear, appetizing recipe name
- description: Brief 1-2 sentence description
- ingredients: List of ingredients needed (from available list + missing)
- missingIngredients: ONLY common pantry staples or 1-2 key items
- cookingTime: Realistic time in minutes
- difficulty: "Easy", "Medium", or "Hard"
- instructions: Clear, numbered steps (5-8 steps)

Return ONLY a JSON array in this exact format:
[
  {{
    "name": "Recipe Name",
    "description": "Brief description",
    "ingredients": ["ingredient1", "ingredient2"],
    "missingIngredients": ["item1", "item2"],
    "cookingTime": 30,
    "difficulty": "Easy",
    "instructions": ["Step 1", "Step 2", "Step 3"]
  }}
]

Only return the JSON array, nothing else."""

    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4000,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}]
            }
        ]
    }
    
    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body)
    )
    
    response_body = json.loads(response['body'].read())
    content = response_body['content'][0]['text']
    
    try:
        recipes = json.loads(content)
        return recipes
    except:
        return [{
            "name": "Error parsing recipes",
            "description": "Could not parse recipe suggestions",
            "ingredients": ingredients,
            "missingIngredients": [],
            "cookingTime": 0,
            "difficulty": "Unknown",
            "instructions": []
        }]


def error_response(status_code: int, message: str):
    """Return error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': message})
    }
