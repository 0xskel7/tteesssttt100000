import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
/** Skip JWT auth for this route (still rate-limited unless also decorated). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
