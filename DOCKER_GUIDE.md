# Docker Setup Guide for Segecha Internal Tracker

This project uses Docker to ensure environment consistency and simplify the development and deployment workflow.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- A valid `.env` file in the root directory (containing `DATABASE_URL`, `ADMIN_KEY`, etc.).

## Quick Start (Docker Compose)

The easiest way to run the entire application (Server + all Frontends) is using Docker Compose.

1.  **Build and Start the Containers**:
    ```bash
    docker-compose up --build -d
    ```

2.  **View Logs**:
    ```bash
    docker-compose logs -f
    ```

3.  **Stop the Containers**:
    ```bash
    docker-compose down
    ```

## Accessing the Portals

Once the containers are running, you can access the portals at:

- **Admin Portal**: [http://localhost:3001/](http://localhost:3001/)
- **Driver Portal**: [http://localhost:3001/driver](http://localhost:3001/driver)
- **Payment Portal**: [http://localhost:3001/pay](http://localhost:3001/pay)
- **Track Portal**: [http://localhost:3001/track](http://localhost:3001/track)

## Troubleshooting

- **Database Connection**: Ensure your `DATABASE_URL` in the `.env` file is accessible from within the Docker container. If you're using a local database on your host machine, use `host.docker.internal` instead of `localhost`.
- **Port Conflicts**: If port 3001 is already in use, you can change the mapping in `docker-compose.yml`.

## Deployment

To deploy this image to production (e.g., Railway or AWS), you can use the provided `Dockerfile`. Most modern hosting platforms will automatically detect the `Dockerfile` and build it for you.
