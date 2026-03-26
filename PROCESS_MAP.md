# Recipe Finder App - Process Flow

## High-Level Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   User's    │      │   S3 Static  │      │ API Gateway │      │    Lambda    │
│   Browser   │─────▶│   Website    │─────▶│   (REST)    │─────▶│   Function   │
│             │      │              │      │             │      │              │
└─────────────┘      └──────────────┘      └─────────────┘      └──────┬───────┘
                                                                         │
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │   Bedrock    │
                                                                  │  Claude 3.5  │
                                                                  │   Sonnet     │
                                                                  └──────────────┘
```

## Detailed Process Flow

### 1. User Interaction (Frontend)
```
User opens website
    │
    ├─▶ Loads HTML/CSS/JS from S3
    │
    ├─▶ User uploads 1-2 images (fridge/pantry)
    │   │
    │   ├─▶ If HEIC format:
    │   │   └─▶ Convert to JPEG using heic2any library
    │   │
    │   ├─▶ Compress & resize image:
    │   │   ├─▶ Max dimension: 1200px
    │   │   └─▶ JPEG quality: 0.7
    │   │
    │   └─▶ Convert to Base64 string
    │
    ├─▶ User selects preferences (optional):
    │   ├─▶ Dietary restrictions
    │   ├─▶ Cuisine type
    │   ├─▶ Cooking time
    │   └─▶ Skill level
    │
    └─▶ User clicks "Find Recipes"
```

### 2. API Request
```
Frontend sends POST request to API Gateway
    │
    ├─▶ Endpoint: /prod/analyze
    │
    ├─▶ Payload:
    │   {
    │     "images": ["base64_image1", "base64_image2"],
    │     "preferences": {
    │       "dietary": "vegetarian",
    │       "cuisine": "italian",
    │       "cookingTime": "30",
    │       "skillLevel": "beginner"
    │     }
    │   }
    │
    └─▶ Headers:
        └─▶ Content-Type: application/json
```

### 3. API Gateway Processing
```
API Gateway receives request
    │
    ├─▶ Validates request format
    │
    ├─▶ Handles CORS (allows cross-origin requests)
    │
    ├─▶ Invokes Lambda function (AWS_PROXY integration)
    │
    └─▶ Passes entire request to Lambda
```

### 4. Lambda Function Processing
```
Lambda function (recipe_finder.py) executes
    │
    ├─▶ Parse request body
    │   └─▶ Extract images array and preferences
    │
    ├─▶ Clean image data
    │   └─▶ Remove "data:image/jpeg;base64," prefix if present
    │
    ├─▶ STEP 1: Analyze Images (analyze_images function)
    │   │
    │   ├─▶ Build Bedrock API request:
    │   │   ├─▶ Model: Claude 3.5 Sonnet
    │   │   ├─▶ Content: Array of images + text prompt
    │   │   └─▶ Max tokens: 2000
    │   │
    │   ├─▶ Send to Bedrock with prompt:
    │   │   "Analyze these images and list all visible ingredients"
    │   │
    │   ├─▶ Bedrock Claude processes images using vision
    │   │
    │   ├─▶ Receive response with ingredient list
    │   │
    │   └─▶ Parse JSON array: ["eggs", "milk", "cheese", ...]
    │
    ├─▶ STEP 2: Generate Recipes (generate_recipes function)
    │   │
    │   ├─▶ Build Bedrock API request:
    │   │   ├─▶ Model: Claude 3.5 Sonnet
    │   │   ├─▶ Content: Ingredients list + preferences + prompt
    │   │   └─▶ Max tokens: 4000
    │   │
    │   ├─▶ Send to Bedrock with prompt:
    │   │   "Suggest 3-5 recipes using these ingredients"
    │   │
    │   ├─▶ Bedrock Claude generates recipe suggestions
    │   │
    │   └─▶ Parse JSON array of recipes:
    │       [
    │         {
    │           "name": "Scrambled Eggs",
    │           "description": "Quick breakfast",
    │           "ingredients": ["eggs", "milk", "butter"],
    │           "missingIngredients": ["salt", "pepper"],
    │           "cookingTime": 10,
    │           "difficulty": "Easy",
    │           "instructions": ["Step 1", "Step 2", ...]
    │         }
    │       ]
    │
    └─▶ Return response:
        {
          "statusCode": 200,
          "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          "body": {
            "ingredients": [...],
            "recipes": [...]
          }
        }
```

### 5. Response Flow
```
Lambda returns response to API Gateway
    │
    ├─▶ API Gateway adds CORS headers
    │
    ├─▶ Returns response to browser
    │
    └─▶ Frontend receives JSON response
```

### 6. Frontend Display
```
Frontend processes response
    │
    ├─▶ Display detected ingredients:
    │   └─▶ Show as colored tags
    │
    └─▶ Display recipe cards:
        ├─▶ Recipe name & description
        ├─▶ Cooking time & difficulty
        ├─▶ Ingredients list (with checkmarks)
        ├─▶ Missing ingredients (with circles)
        └─▶ Step-by-step instructions
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                              │
│                                                                   │
│  1. Upload Images ──▶ 2. Compress ──▶ 3. Convert to Base64      │
│                                                                   │
│  4. Add Preferences ──▶ 5. Build JSON Payload                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼ HTTP POST
┌──────────────────────────────────────────────────────────────────┐
│                       API GATEWAY                                 │
│                                                                   │
│  1. Receive Request ──▶ 2. Validate ──▶ 3. Add CORS             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼ Invoke
┌──────────────────────────────────────────────────────────────────┐
│                      LAMBDA FUNCTION                              │
│                                                                   │
│  1. Parse Images ──▶ 2. Call Bedrock (Vision) ──▶ Get Ingredients│
│                                                                   │
│  3. Call Bedrock (Text) ──▶ Generate Recipes                     │
│                                                                   │
│  4. Format Response ──▶ Return JSON                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼ Response
┌──────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                              │
│                                                                   │
│  1. Receive JSON ──▶ 2. Parse Data ──▶ 3. Display Results       │
└──────────────────────────────────────────────────────────────────┘
```

## AWS Services Used

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **S3** | Static website hosting | Public read access, website hosting enabled |
| **API Gateway** | REST API endpoint | Regional, CORS enabled, Lambda proxy integration |
| **Lambda** | Backend processing | Python 3.11, 512MB RAM, 90s timeout |
| **Bedrock** | AI image analysis & recipe generation | Claude 3.5 Sonnet model |
| **IAM** | Permissions | Lambda execution role with Bedrock access |

## Key Technologies

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with gradients
- **Vanilla JavaScript** - Logic (no frameworks)
- **heic2any** - HEIC to JPEG conversion
- **Canvas API** - Image compression

### Backend
- **Python 3.11** - Lambda runtime
- **boto3** - AWS SDK for Bedrock
- **JSON** - Data format

### AI
- **Claude 3.5 Sonnet** - Vision + text generation
- **Bedrock API** - AWS managed AI service

## Cost Breakdown (Approximate)

```
Per Request:
├─▶ API Gateway: $0.0000035 per request
├─▶ Lambda: $0.0000002 per 100ms (avg 10s = $0.00002)
└─▶ Bedrock Claude 3.5 Sonnet:
    ├─▶ Input: ~$3 per 1M tokens (2 images + text ≈ 2000 tokens = $0.006)
    └─▶ Output: ~$15 per 1M tokens (recipes ≈ 1000 tokens = $0.015)

Total per request: ~$0.021 (2 cents)
```

## Error Handling

```
Potential Errors:
│
├─▶ Image too large
│   └─▶ Frontend compresses before sending
│
├─▶ HEIC format
│   └─▶ Frontend converts to JPEG
│
├─▶ API Gateway timeout (29s)
│   └─▶ Lambda timeout set to 90s (shouldn't hit API limit)
│
├─▶ Bedrock access denied
│   └─▶ Check IAM permissions & model access
│
├─▶ Invalid JSON from Bedrock
│   └─▶ Fallback parsing in Lambda
│
└─▶ CORS errors
    └─▶ API Gateway configured with proper headers
```

## Security Features

```
Security Layers:
│
├─▶ S3 Bucket Policy: Public read only
│
├─▶ API Gateway: No authentication (public API)
│
├─▶ Lambda: Isolated execution environment
│
├─▶ IAM Role: Least privilege (Bedrock + CloudWatch only)
│
└─▶ Bedrock: AWS managed, no data retention
```

## Performance Optimizations

```
Optimizations:
│
├─▶ Image Compression: Reduces payload size by ~70%
│
├─▶ Lambda Memory: 512MB for faster execution
│
├─▶ API Gateway: Regional endpoint (lower latency)
│
├─▶ Bedrock: Streaming disabled (simpler, faster for small responses)
│
└─▶ Frontend: Minimal dependencies (fast load time)
```
