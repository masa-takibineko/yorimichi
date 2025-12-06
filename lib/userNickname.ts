const NICKNAME_KEY = "yorimichi_user_nickname";

export function getOrCreateNickname(): string {
  if (typeof window === "undefined") return "";

  const existing = localStorage.getItem(NICKNAME_KEY);
  if (existing && existing.trim()) return existing;

  const input = window
    .prompt("はじめまして！投稿者名（ニックネーム）を教えてください。", "")
    ?.trim();
  const fallback = `旅人-${Math.random().toString(36).slice(2, 6)}`;
  const nickname = input || fallback;
  localStorage.setItem(NICKNAME_KEY, nickname);
  return nickname;
}

export function setNickname(nickname: string) {
  if (typeof window === "undefined") return;
  const nick = nickname.trim();
  if (!nick) return;
  localStorage.setItem(NICKNAME_KEY, nick);
}
