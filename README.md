# Internal Tools Dashboard

A collection of utilities and tools to streamline internal operations and workflows.

## Features

- **Password Protection**: Secure access control with IP-based rate limiting
- **Webhook Tools**: Utilities for webhook management and testing
- **User Management**: Tools for user administration and monitoring
- **Modern UI**: Built with React, TanStack Router, and Tailwind CSS

## Security

This application is protected by a password system that:
- Requires authentication for all routes
- Bans IPs after 5 failed password attempts (24-hour ban)
- Remembers authenticated browsers to avoid repeated logins
- Uses secure HTTP-only cookies for session management

## Development

From your terminal:

```sh
pnpm install
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

The application is configured for deployment with:
- Docker support (`Dockerfile`, `docker-compose.yml`)
- Unraid deployment (`unraid-docker-compose.yml`, `unraid-template.xml`)
- Environment-based configuration

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [UNRAID-SETUP.md](./UNRAID-SETUP.md) for deployment instructions.

## Development

From your terminal:

```sh
pnpm install
pnpm dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Editing and previewing the docs of TanStack projects locally

The documentations for all TanStack projects except for `React Charts` are hosted on [https://tanstack.com](https://tanstack.com), powered by this TanStack Router app.
In production, the markdown doc pages are fetched from the GitHub repos of the projects, but in development they are read from the local file system.

Follow these steps if you want to edit the doc pages of a project (in these steps we'll assume it's [`TanStack/form`](https://github.com/tanstack/form)) and preview them locally :

1. Create a new directory called `tanstack`.

```sh
mkdir tanstack
```

2. Enter the directory and clone this repo and the repo of the project there.

```sh
cd tanstack
git clone git@github.com:TanStack/tanstack.com.git
git clone git@github.com:TanStack/form.git
```

> [!NOTE]
> Your `tanstack` directory should look like this:
>
> ```
> tanstack/
>    |
>    +-- form/
>    |
>    +-- tanstack.com/
> ```

> [!WARNING]
> Make sure the name of the directory in your local file system matches the name of the project's repo. For example, `tanstack/form` must be cloned into `form` (this is the default) instead of `some-other-name`, because that way, the doc pages won't be found.

3. Enter the `tanstack/tanstack.com` directory, install the dependencies and run the app in dev mode:

```sh
cd tanstack.com
pnpm i
# The app will run on https://localhost:3000 by default
pnpm dev
```

4. Now you can visit http://localhost:3000/form/latest/docs/overview in the browser and see the changes you make in `tanstack/form/docs`.

> [!NOTE]
> The updated pages need to be manually reloaded in the browser.

> [!WARNING]
> You will need to update the `docs/config.json` file (in the project's repo) if you add a new doc page!
