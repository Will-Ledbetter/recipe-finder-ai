#!/bin/bash

echo "Updating Lambda functions from Python 3.9 to Python 3.12..."

# Update recipe-finder-auth function
echo "1. Updating recipe-finder-auth runtime..."
aws lambda update-function-configuration \
    --function-name recipe-finder-auth \
    --runtime python3.12 \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ recipe-finder-auth updated successfully"
else
    echo "✗ Failed to update recipe-finder-auth"
fi

# Update recipe-finder-tracking function
echo "2. Updating recipe-finder-tracking runtime..."
aws lambda update-function-configuration \
    --function-name recipe-finder-tracking \
    --runtime python3.12 \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✓ recipe-finder-tracking updated successfully"
else
    echo "✗ Failed to update recipe-finder-tracking"
fi

echo ""
echo "Runtime update complete!"
echo ""
echo "Verifying updates..."
aws lambda get-function --function-name recipe-finder-auth --region us-east-1 --query 'Configuration.Runtime'
aws lambda get-function --function-name recipe-finder-tracking --region us-east-1 --query 'Configuration.Runtime'