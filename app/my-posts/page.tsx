"use client";

import React, { useEffect, useState } from "react";
import { Heart, MapPin, Trash2, ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getUserId } from "../../lib/userId";
import Link from "next/link";

type Photo = {
  id: number | string;
  src: string;
  location: string;
  title: string;
  votes: number;
  author: string;
  user_id: string;
  episode: string;
  lat: number;
  lng: number;
  created_at?: string;
  isLiked?: boolean;
};

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const PAYPAY_LINK = "https://pay.paypay.ne.jp/あなたのリンク";

export default function MyPostsPage() {
  const [myPhotos, setMyPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = getUserId();

  useEffect(() => {
    const load = async () => {
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (photosError) {
        console.error("投稿の取得に失敗しました:", photosError);
        setLoading(false);
        return;
      }

      if (!photosData || photosData.length === 0) {
        setMyPhotos([]);
        setLoading(false);
        return;
      }

      // いいね数を取得
      const { data: allLikes } = await supabase.from("likes").select("photo_id");

      const voteCounts: Record<number | string, number> = {};
      (allLikes || []).forEach((like: any) => {
        voteCounts[like.photo_id] = (voteCounts[like.photo_id] || 0) + 1;
      });

      const mapped: Photo[] = photosData.map((row: any) => ({
        id: row.id,
        src: row.image_url,
        location: row.location,
        title: row.title || "",
        votes: voteCounts[row.id] || 0,
        author: row.author ?? "あなた",
        user_id: row.user_id || "",
        episode: row.episode,
        lat: row.lat,
        lng: row.lng,
        created_at: row.created_at,
      }));

      setMyPhotos(mapped);
      setLoading(false);
    };

    load();
  }, [userId]);

  const handleDelete = async (photoId: number | string) => {
    if (!confirm("この投稿を削除しますか？この操作は取り消せません。")) {
      return;
    }

    const { error } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId)
      .eq("user_id", userId);

    if (error) {
      alert("削除に失敗しました: " + error.message);
      return;
    }

    setMyPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen w-full bg-[#f7f2ea] pb-20">
      {/* ヘッダー */}
      <header className="w-full bg-[#ede7da] border-b border-[#e4dccc] sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-[#947962] hover:text-[#7c6c57] transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-semibold text-[#7a6047]">
            自分の投稿一覧
          </h1>
        </div>
      </header>

      {/* コンテンツ */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 rounded-lg border border-[#e4dccc] bg-white/80 px-3 py-2 text-sm text-[#6b5947] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>
            このアプリを気に入ってくれたら、
            <span className="font-semibold">PayPay</span> でそっと応援してもらえると嬉しいです ☕️
          </p>
          <a
            href={PAYPAY_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-red-500 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-600 transition"
          >
            ❤️ PayPayで応援する
          </a>
        </div>
        {loading ? (
          <div className="text-center text-[#7c6c57] py-12">
            読み込み中...
          </div>
        ) : myPhotos.length === 0 ? (
          <div className="text-center text-[#7c6c57] py-12">
            <p className="text-lg mb-2">まだ投稿がありません</p>
            <Link
              href="/"
              className="text-[#947962] hover:text-[#7c6c57] underline"
            >
              地図に戻って投稿してみましょう
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myPhotos.map((photo) => (
              <div
                key={photo.id}
                className="bg-[#f6f1e6] rounded-2xl overflow-hidden border border-[#dbcab1] shadow-md hover:shadow-lg transition"
              >
                {/* 写真 */}
                <div className="aspect-square overflow-hidden bg-[#f8f5ee]">
                  <img
                    src={photo.src}
                    alt={photo.location}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 情報 */}
                <div className="p-4">
                  {photo.title && (
                    <h3 className="font-semibold text-[#7a6047] mb-2 line-clamp-1">
                      {photo.title}
                    </h3>
                  )}
                  <div className="flex items-center gap-2 mb-2 text-sm text-[#86664b]">
                    <MapPin className="w-4 h-4" />
                    <span className="line-clamp-1">{photo.location}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-3 text-sm text-[#957c62]">
                    <Heart className="w-4 h-4" fill="currentColor" />
                    <span>{photo.votes}</span>
                  </div>
                  <p className="text-sm text-[#726450] line-clamp-3 mb-3">
                    {photo.episode}
                  </p>
                  {photo.created_at && (
                    <p className="text-xs text-[#aa9278] mb-3">
                      {formatDate(photo.created_at)}
                    </p>
                  )}
                  <button
                    onClick={() => handleDelete(photo.id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

