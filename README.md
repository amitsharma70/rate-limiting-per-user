# Node.js API with User Task Queuing and Rate Limiting

## Overview
This project implements a Node.js API that processes user tasks while enforcing rate limits:
- **1 task per second per user.**
- **20 tasks per minute per user.**
Tasks exceeding the rate limit are queued and processed after the desired interval.

## Features
- API with user-based rate limiting and queuing.
- Resilient task queueing system using Redis.
- Clustered Node.js application for scalability (2 replicas).
- Task logging to a file (`task.log`).

---

## Prerequisites
1. **Node.js** (v14+ recommended)
2. **Redis** (running locally or accessible remotely)
3. **PM2** (for clustering)
   ```bash
   npm install -g pm2
