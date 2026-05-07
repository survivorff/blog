import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

/**
 * 站点主 OG 图 (1200 × 630)
 *
 * 用于首页、about 等非文章页的分享卡片
 */
export default async () => {
  const hostname = new URL(SITE.website).hostname;

  return satori(
    {
      type: "div",
      props: {
        style: {
          background: "#fefbfb",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          fontFamily: "IBM Plex Mono, monospace",
        },
        children: [
          // 顶部：站点 logo
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "14px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      width: "56px",
                      height: "56px",
                      borderRadius: "12px",
                      background: "#000",
                      color: "#fefbfb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "36px",
                      fontWeight: "bold",
                    },
                    children: "s",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "24px",
                      color: "#555",
                      fontWeight: 500,
                    },
                    children: hostname,
                  },
                },
              ],
            },
          },

          // 中间：站点标题 + 描述
          {
            type: "div",
            props: {
              style: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 86,
                      fontWeight: "bold",
                      color: "#111",
                      lineHeight: 1.1,
                    },
                    children: SITE.title,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      marginTop: "20px",
                      fontSize: 28,
                      color: "#555",
                      lineHeight: 1.4,
                      maxWidth: "900px",
                    },
                    children: SITE.desc,
                  },
                },
              ],
            },
          },

          // 底部：作者标识
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                marginTop: "auto",
                fontSize: 24,
                color: "#333",
              },
              children: [
                {
                  type: "span",
                  props: {
                    style: { color: "#888" },
                    children: "@",
                  },
                },
                {
                  type: "span",
                  props: {
                    style: { fontWeight: "bold" },
                    children: SITE.author,
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(
        SITE.title + SITE.desc + SITE.author + hostname + "@s"
      ),
    }
  );
};
