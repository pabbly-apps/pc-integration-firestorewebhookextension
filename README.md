# Firebase Firestore Functions & Extensions

## Overview

This project contains Firebase Cloud Functions and a Firebase Extension to automate workflows triggered by Firestore events. It listens to document changes (create, update, delete) and sends real-time webhooks or notifications, reducing manual work and enabling integration with external systems.

## Features

- Trigger Cloud Functions on Firestore document create, update, and delete events.
- Send webhook notifications with document data.
- Configurable Firebase Extension for easy installation and reuse.
- Supports dynamic document paths with wildcards.
- Includes error handling, logging, and security best practices.

## Installation

### Prerequisites

- Node.js (v20 or newer)  
- Firebase CLI (`npm install -g firebase-tools`)  
- Firebase project with Firestore enabled

### Steps

1. Clone the repo:  

2. Install dependencies:  

3. Login to Firebase:  

4. Select your Firebase project:  

5. Install the extension locally:  

6. Provide configuration parameters when prompted.

## Usage

- The extension triggers automatically on Firestore document events.
- Configure webhook URLs and parameters during installation.
- Monitor logs and performance via Firebase Console.

## Configuration

- Modify `extension.yaml` for metadata, parameters, and triggers.
- Secure sensitive data (API keys, webhook URLs) during installation.
- Use environment variables or Firebase Secret Manager for secrets.

## Best Practices

- Use wildcards for scalable document paths.
- Add error handling and detailed logging with Firebase `logger`.
- Keep sensitive data secure, avoid hardcoding secrets.
- Monitor function usage and costs regularly.

## Contributing

Contributions welcome! Fork the repo and submit pull requests.

## License

Apache-2.0

## Contact

For support, contact [Pabbly Connect] at [integrations@pabbly.com].
