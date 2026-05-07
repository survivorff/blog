import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";

/**
 * 文章分享卡片 (1200 × 630)
 *
 * 设计：
 *   - 左上角站点标识 + 域名
 *   - 中央大字文章标题
 *   - 底部作者 + 品牌
 *   - 黑白简约，和博客主题保持一致
 */
export default async post => {
  const hostname = new URL(SITE.website).hostname;
  const tags = Array.isArray(post.data.tags) ? post.data.tags : [];
  const visibleTags = tags.slice(0, 4);

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
          position: "relative",
          fontFamily: "IBM Plex Mono, monospace",
        },
        children: [
          // 顶部：站点 logo + 域名
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
                      width: "48px",
                      height: "48px",
                      borderRadius: "10px",
                      background: "#000",
                      color: "#fefbfb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "32px",
                      fontWeight: "bold",
                    },
                    children: "s",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "22px",
                      color: "#555",
                      fontWeight: 500,
                    },
                    children: hostname,
                  },
                },
              ],
            },
          },

          // 中间：文章标题
          {
            type: "div",
            props: {
              style: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                marginTop: "20px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 68,
                      fontWeight: "bold",
                      lineHeight: 1.2,
                      maxHeight: "80%",
                      overflow: "hidden",
                      color: "#111",
                    },
                    children: post.data.title,
                  },
                },
              ],
            },
          },

          // 底部：作者 + tags
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "auto",
                fontSize: 24,
                color: "#333",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: { display: "flex", alignItems: "center" },
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
                          children: post.data.author,
                        },
                      },
                    ],
                  },
                },
                visibleTags.length > 0
                  ? {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          gap: "10px",
                        },
                        children: visibleTags.map(tag => ({
                          type: "div",
                          props: {
                            style: {
                              padding: "4px 14px",
                              borderRadius: "999px",
                              border: "1.5px solid #333",
                              fontSize: 20,
                              color: "#333",
                            },
                            children: `#${tag}`,
                          },
                        })),
                      },
                    }
                  : null,
              ].filter(Boolean),
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
        post.data.title +
          post.data.author +
          hostname +
          visibleTags.join("") +
          "@#s"
      ),
    }
  );
};
