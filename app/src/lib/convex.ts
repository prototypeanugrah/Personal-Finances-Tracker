import { ConvexReactClient } from "convex/react";

// Use environment variable or fallback to local development URL
const convexUrl = import.meta.env.VITE_CONVEX_URL;

// Only create client if URL is configured
export const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export const isConvexConfigured = !!convexUrl;
