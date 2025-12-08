// ユーザーID管理（localStorage ベース）
const USER_ID_KEY = "yorimichi_user_id";

export function getUserId(): string {
  if (typeof window === "undefined") return "";
  
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // UUID v4 を生成（簡易版）
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}


