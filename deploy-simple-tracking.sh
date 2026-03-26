#!/bin/bash

echo "Deploying simple user tracking for Recipe Finder..."

# Step 1: Deploy the tracking Lambda function
echo "1. Creating Lambda deployment package..."
cd lambda
zip -r ../recipe-finder-tracking.zip simple_user_tracker.py

echo "2. Deploying Lambda function..."
cd ..

# Try to create the function first
aws lambda create-function \
    --function-name recipe-finder-tracking \
    --runtime python3.12 \
    --role arn:aws:iam::257641257020:role/recipe-finder-lambda-role \
    --handler simple_user_tracker.lambda_handler \
    --zip-file fileb://recipe-finder-tracking.zip \
    --timeout 30 \
    --memory-size 256 \
    --region us-east-1 2>/dev/null

# If function already exists, update it
if [ $? -ne 0 ]; then
    echo "Function exists, updating..."
    aws lambda update-function-code \
        --function-name recipe-finder-tracking \
        --zip-file fileb://recipe-finder-tracking.zip \
        --region us-east-1
fi

# Clean up
rm recipe-finder-tracking.zip

echo "3. Lambda function deployed successfully!"

# Step 2: Add API Gateway resource (manual step)
echo ""
echo "Next steps (do these manually in AWS Console):"
echo "1. Go to API Gateway console"
echo "2. Select your Recipe Finder API (y0x3260gi3)"
echo "3. Create new resource: /track"
echo "4. Add POST method to /track"
echo "5. Set integration to Lambda function: recipe-finder-tracking"
echo "6. Enable CORS for /track"
echo "7. Deploy to your 'prod' stage"
echo ""
echo "Then update the API endpoint in frontend/simple-tracking.js:"
echo "API_ENDPOINT: 'https://y0x3260gi3.execute-api.us-east-1.amazonaws.com/prod/track'"
echo ""
echo "Finally, upload the updated frontend files to your S3 bucket:"
echo "- index.html (updated)"
echo "- simple-tracking.js (new)"
echo "- app.js (updated)"
echo "- styles.css (updated)"