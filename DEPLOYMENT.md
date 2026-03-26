# Recipe Finder - Deployment Guide

## Prerequisites
- AWS CLI configured with appropriate credentials
- Python 3.11+
- Bedrock model access (Claude 3 Sonnet)

## Step 1: Enable Bedrock Model Access
1. Go to AWS Console → Bedrock → Model access
2. Request access to "Claude 3 Sonnet" model
3. Wait for approval (usually instant)

## Step 2: Deploy Lambda Function
```bash
chmod +x deploy-lambda.sh
./deploy-lambda.sh
```

This will:
- Create IAM role with Bedrock permissions
- Package and deploy Lambda function
- Configure timeout and memory settings

## Step 3: Create API Gateway
```bash
# Create REST API
aws apigateway create-rest-api \
  --name recipe-finder-api \
  --description "Recipe Finder API" \
  --endpoint-configuration types=REGIONAL

# Note the API ID from output
API_ID="your-api-id"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[0].id' \
  --output text)

# Create /analyze resource
RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part analyze \
  --query 'id' \
  --output text)

# Create POST method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name recipe-finder \
  --query 'Configuration.FunctionArn' \
  --output text)

# Set Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

# Add Lambda permission
aws lambda add-permission \
  --function-name recipe-finder \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com

# Enable CORS
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}'

aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers": true, "method.response.header.Access-Control-Allow-Methods": true, "method.response.header.Access-Control-Allow-Origin": true}'

aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'POST,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}'

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod

# Your API endpoint will be:
echo "API Endpoint: https://$API_ID.execute-api.us-east-1.amazonaws.com/prod/analyze"
```

## Step 4: Deploy Frontend

### Option A: S3 + CloudFront (Recommended)
```bash
# Create S3 bucket
BUCKET_NAME="recipe-finder-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME

# Configure for static website hosting
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html

# Update API endpoint in frontend/app.js
# Replace YOUR_API_GATEWAY_URL_HERE with your actual endpoint

# Upload files
aws s3 sync frontend/ s3://$BUCKET_NAME --acl public-read

# Create CloudFront distribution (optional, for HTTPS)
# Follow AWS Console CloudFront setup
```

### Option B: Local Testing
```bash
cd frontend
python3 -m http.server 8000
# Open http://localhost:8000
```

## Step 5: Test the Application
1. Open the frontend URL
2. Upload a test image of a fridge/pantry
3. Click "Find Recipes"
4. Verify ingredients are detected
5. Check recipe suggestions appear

## Troubleshooting

### Lambda timeout errors
Increase timeout:
```bash
aws lambda update-function-configuration \
  --function-name recipe-finder \
  --timeout 90
```

### Bedrock access denied
Verify model access in Bedrock console and IAM permissions

### CORS errors
Ensure API Gateway CORS is properly configured with OPTIONS method

## Cost Optimization
- Use Claude 3 Haiku for lower costs (~$0.00025 per image)
- Implement caching for repeated images
- Set up CloudWatch alarms for usage monitoring

## Security Enhancements
- Add API key authentication
- Implement rate limiting
- Use WAF for DDoS protection
- Enable CloudTrail logging
