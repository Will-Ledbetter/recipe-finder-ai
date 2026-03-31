# Recipe Finder App

AI-powered recipe suggestions based on fridge and pantry photos using AWS Bedrock Claude with vision.

## Features
- Upload photos of your fridge/pantry
- AI vision analysis identifies ingredients
- Get recipe suggestions based on available items
- Filter by dietary preferences, cuisine type, cooking time

## LinkedIn Post

[See it in action](https://www.linkedin.com/posts/will-ledbetter-114318167_aws-amazonkiro-awskiro-activity-7406546574559846400-uyCK?utm_source=share&utm_medium=member_desktop&rcm=ACoAACe8W6ABz_yW6tZUwf4zTku75hhXakj6lxU)

## Architecture
- **Frontend**: Static HTML/JS hosted on S3 + CloudFront
- **API**: API Gateway + Lambda
- **AI**: Amazon Bedrock (Claude 3 with vision)
- **Storage**: S3 for image uploads

## Quick Start
1. Deploy Lambda function: `./deploy-lambda.sh`
2. Deploy frontend: `cd frontend && npm run build`
3. Update API endpoint in frontend config

## Cost Estimate
- Bedrock Claude 3 Sonnet: ~$0.003 per image analysis
- Lambda: Free tier covers most usage
- S3: Minimal storage costs
- API Gateway: ~$3.50 per million requests

## Environment Variables
- `BEDROCK_MODEL_ID`: Claude model (default: anthropic.claude-3-sonnet-20240229-v1:0)
- `MAX_IMAGE_SIZE`: Max upload size in MB (default: 5)
