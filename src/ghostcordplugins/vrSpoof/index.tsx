/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
  name: "VRSpoof",
  description: "Makes your Discord session report as a VR client, so the VR headset indicator shows on your avatar and in voice channels.",
  authors: [{ name: "Aurick", id: 1348025017233047634n }],

  patches: [
    // Desktop-only: also feeds the X-Super-Properties REST header.
    {
      find: 'browser:"Discord Client"',
      replacement: {
        match: /os:[^,]+,browser:"Discord Client"/,
        replace: 'os:"android",browser:"Discord VR"',
      },
    },
    // Gateway IDENTIFY, shared by desktop and web-based clients like Vesktop.
    {
      find: "_doIdentify(){",
      replacement: [
        // Skip adopting the desktop app's pre-connected socket so a fresh IDENTIFY is sent.
        {
          match: /window\._ws=null,null!=\i/,
          replace: "false",
        },
        {
          match: /(?<="GatewaySocket"\)\}\),properties:)(\i)/,
          replace: '{...$1,os:"android",browser:"Discord VR"}',
        },
      ],
    },
  ],
});
