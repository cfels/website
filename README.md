## my personal website

### running on your local network

```sh
bun run build
bun run start
```

The production server listens on all network interfaces on port 3000. Open
`http://localhost:3000` on this computer, or `http://<your-local-IP>:3000` on
another device connected to the same network. Keep the server and computer
running while using the site. If Windows Firewall prompts for access, allow
Node.js on private networks. Your local IP address may change after reconnecting.

### deploying
```
bun install
bun run build
node build
```

then just add it to your caddyfile and cloudflare so people can access it.
