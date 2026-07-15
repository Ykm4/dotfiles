// Finicky (https://github.com/johnste/finicky) の設定。
// Finicky を macOS の既定ブラウザにし、リンクを URL パターンごとに開くブラウザ・プロファイルへ振り分ける。
export default {
  // ふだんのリンクは従来どおり Arc で開く
  defaultBrowser: "Arc",
  handlers: [
    {
      // Claude 関連（デスクトップアプリの認証を含む）は Chrome の個人プロファイルで開く
      match: [
        "claude.ai/*",
        "*.claude.ai/*",
        "anthropic.com/*",
        "*.anthropic.com/*",
      ],
      browser: {
        name: "Google Chrome",
        // Chrome のプロファイル表示名で指定する（= ykum4suke@gmail.com、ディレクトリは Profile 1）。
        // Chrome 側でプロファイル名を変更したらここも合わせる。
        profile: "ykum4suke",
      },
    },
  ],
};
