import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("stream/*", "routes/stream.tsx"),
  route("stop-transcode", "routes/stop-transcode.tsx"),
  route("transcode-status", "routes/transcode-status.tsx"),
  route("transcode-seek", "routes/transcode-seek.tsx"),
] satisfies RouteConfig;
