"use client";

import React, { useEffect, useRef, useState } from "react";
import { Heart, MapPin, Plus, Search, Trash2, Trophy } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getUserId } from "../lib/userId";
import { getOrCreateNickname, setNickname } from "../lib/userNickname";

// ダミーデータ（初期の道草）: Supabase に何もない場合の初期表示用
const initialPhotos = [
  {
    id: 1,
    src:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
    location: "長野県 木曽路",
    title: "",
    votes: 42,
    author: "村上 健一",
    user_id: "",
    episode:
      "川沿いの小径を歩くと、遠くから草笛の音が微かに聞こえてきた。幼い頃に父と歩いた、この道草の思い出がふと蘇る。陽に透ける葉の影が、あの頃と少しも変わらず揺れていた。",
    lat: 35.79,
    lng: 137.69,
    isLiked: false,
  },
  {
    id: 2,
    src:
      "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=600&q=80",
    location: "熊本県 南小国町",
    title: "",
    votes: 31,
    author: "佐藤 美咲",
    user_id: "",
    episode:
      "雨上がりの田んぼ道で見つけた小さなカエル。泥の匂いと、靴に絡む草の感触。都会では忘れていた感覚が、心の奥底で静かに鳴りはじめた。",
    lat: 33.11,
    lng: 131.11,
    isLiked: false,
  },
  {
    id: 3,
    src:
      "https://images.unsplash.com/photo-1518085250887-2f903c200fee?auto=format&fit=crop&w=600&q=80",
    location: "岐阜県 高山市",
    title: "",
    votes: 58,
    author: "山本 純",
    user_id: "",
    episode:
      "道端の小さな地蔵に手を合わせるおばあさんの背中。染み付いた土地の時間が、写真越しにも優しく伝わってきた。懐かしくて、美しい一瞬。",
    lat: 36.15,
    lng: 137.25,
    isLiked: false,
  },
];
const OFUSE_LINK = "https://ofuse.me/aaf1f80c";

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
  isLiked?: boolean;
};

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function shuffleArray<T>(arr: T[]) {
  // Fisher-Yates shuffle to randomize表示順
  const cloned = [...arr];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

export default function Home() {
  const [photoList, setPhotoList] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [isPostSelecting, setIsPostSelecting] = useState(false);
  const [pendingLatLng, setPendingLatLng] = useState<[number, number] | null>(
    null,
  );
  const [userId] = useState<string>(() => getUserId());
  const [todayPostCount, setTodayPostCount] = useState<number>(0);
  const [mostPopularPhoto, setMostPopularPhoto] = useState<Photo | null>(null);
  const initialNickname =
    typeof window !== "undefined" ? getOrCreateNickname() : "";
  const [userNickname, setUserNickname] = useState(initialNickname);
  const [nicknameInput, setNicknameInput] = useState(initialNickname);

  // Leaflet map 用の ref（型は簡略化）
  const mapRef = useRef<any | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<any[]>([]);

  // 初期表示は日本列島あたりを広く映す
  const initialCenter: [number, number] = [36.0, 137.0];
  const [mapReady, setMapReady] = useState(false);

  // Supabase から投稿済みの写真を読み込む
  useEffect(() => {
    let cancelled = false;

    // 初回にニックネームを確定
    if (!cancelled && typeof window !== "undefined") {
      const nickname = getOrCreateNickname();
      setUserNickname(nickname);
      setNickname(nickname);
    }

    const tableMissingHint =
      `Supabase のテーブルが未作成です。` +
      `以下の SQL を Supabase SQL Editor などで実行してテーブルを作成してください。\n` +
      `-- photos テーブル\n` +
      `create table if not exists public.photos (\n` +
      `  id bigserial primary key,\n` +
      `  image_url text,\n` +
      `  location text,\n` +
      `  title text,\n` +
      `  episode text,\n` +
      `  author text,\n` +
      `  user_id text,\n` +
      `  lat double precision,\n` +
      `  lng double precision,\n` +
      `  votes integer default 0,\n` +
      `  created_at timestamptz default now()\n` +
      `);\n` +
      `-- likes テーブル（いいね管理）\n` +
      `create table if not exists public.likes (\n` +
      `  id bigserial primary key,\n` +
      `  photo_id bigint references public.photos(id) on delete cascade,\n` +
      `  user_id text not null,\n` +
      `  created_at timestamptz default now(),\n` +
      `  unique(photo_id, user_id)\n` +
      `);\n` +
      `-- RLS ポリシー（必要に応じて）\n` +
      `alter table public.photos enable row level security;\n` +
      `alter table public.likes enable row level security;\n` +
      `create policy "Anyone can read photos" on public.photos for select using (true);\n` +
      `create policy "Anyone can insert photos" on public.photos for insert with check (true);\n` +
      `create policy "Users can delete own photos" on public.photos for delete using (user_id = current_setting('app.user_id', true));\n` +
      `create policy "Anyone can read likes" on public.likes for select using (true);\n` +
      `create policy "Anyone can insert likes" on public.likes for insert with check (true);\n` +
      `create policy "Anyone can delete likes" on public.likes for delete using (true);`;

    const load = async () => {
      // photos と likes を同時に取得（並びは後でランダム化するため order は指定しない）
      const { data: photosData, error: photosError } = await supabase
        .from("photos")
        .select("*");

      if (photosError) {
        if (
          typeof photosError.message === "string" &&
          photosError.message.includes("Could not find the table")
        ) {
          console.warn(tableMissingHint);
        }
        console.error(
          "Supabase からの取得に失敗しました:",
          photosError?.message ?? photosError,
        );
        if (!cancelled) setPhotoList(shuffleArray(initialPhotos));
        return;
      }

      if (!photosData || photosData.length === 0) {
        if (!cancelled) setPhotoList(shuffleArray(initialPhotos));
        return;
      }

      // いいね情報を取得
      const { data: likesData } = await supabase
        .from("likes")
        .select("photo_id")
        .eq("user_id", userId);

      const likedPhotoIds = new Set(
        (likesData || []).map((l: any) => l.photo_id),
      );

      // 各写真のいいね数をカウント
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
        author: row.author ?? "誰かの道草",
        user_id: row.user_id || "",
        episode: row.episode,
        lat: row.lat,
        lng: row.lng,
        isLiked: likedPhotoIds.has(row.id),
      }));

      // 最も人気の投稿を特定
      const mostPopular = mapped.reduce((max, photo) =>
        photo.votes > max.votes ? photo : max,
      );

      if (!cancelled) {
        const shuffled = shuffleArray(mapped);
        setPhotoList(shuffled);
        setMostPopularPhoto(mostPopular.votes > 0 ? mostPopular : null);
      }

      // 今日の投稿数をチェック
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();

      const { data: todayPosts } = await supabase
        .from("photos")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", todayStart);

      if (!cancelled) {
        setTodayPostCount(todayPosts?.length || 0);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    let isMounted = true;

    (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;

      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(initialCenter, 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        markersRef.current.forEach((m) => m.remove());
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = [];
      }
    };
  }, []);

  // 写真リストが変わるたびにマーカーを張り直す
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!mapRef.current || !mapReady) return;

      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;

      if (!isMounted || !mapRef.current) return;

      // 投稿位置選択中は写真ピンを一時的に非表示にして選択しやすくする
      if (isPostSelecting) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        return;
      }

      // 既存マーカーをクリア
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 写真サムネイル付きのカスタムピン（描画順も毎回ランダム化）
      const photosForRender = shuffleArray(photoList);
      photosForRender.forEach((photo) => {
        const isMostPopular =
          mostPopularPhoto && mostPopularPhoto.id === photo.id && photo.votes > 0;
        const icon = L.divIcon({
          className: "",
          iconSize: [90, 90],
          html: `
            <div style="
              width:80px;
              height:80px;
              border-radius:18px;
              overflow:hidden;
              box-shadow:0 10px 20px rgba(0,0,0,0.22);
              border:${isMostPopular ? "3px solid #fbbf24" : "2px solid #dccfb8"};
              background:#f8f5ee;
              position:relative;
            ">
              <img
                src="${photo.src}"
                alt="${photo.location}"
                style="width:100%;height:100%;object-fit:cover;"
                draggable="false"
              />
              ${isMostPopular ? `<div style="position:absolute;top:-8px;right:-8px;background:#fbbf24;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:14px;">🏆</div>` : ""}
              <div style="
                position:absolute;
                right:4px;
                bottom:4px;
                padding:2px 6px;
                border-radius:999px;
                background:rgba(237,231,218,0.95);
                display:flex;
                align-items:center;
                gap:4px;
                font-size:11px;
                color:#957c62;
              ">
                <span>❤</span>
                <span>${photo.votes}</span>
              </div>
            </div>
          `,
        });

        const marker = L.marker([photo.lat, photo.lng], {
          icon,
          // z-index をランダムにずらして重なり順を毎回変える
          zIndexOffset: Math.floor(Math.random() * 100000),
        }).addTo(mapRef.current);
        marker.on("click", () => {
          setSelectedPhoto(photo);
        });
        markersRef.current.push(marker);
      });
    })();

    return () => {
      isMounted = false;
    };
  }, [photoList, mapReady, mostPopularPhoto, isPostSelecting]);

  // 投稿モード中は、地図クリックで投稿位置を決める
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const handleClick = (e: any) => {
      if (!isPostSelecting) return;
      setPendingLatLng([e.latlng.lat, e.latlng.lng]);
      setIsPostSelecting(false);
      setIsPostOpen(true);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [isPostSelecting]);

  // Supabase で保存するようにしたので、localStorage への保存は不要になった

  return (
    <main className="relative min-h-screen w-full bg-[#f7f2ea]">
      {/* 投稿場所選択中の全画面フェード */}
      {isPostSelecting && (
        <div className="fixed inset-0 bg-black/35 z-[900] pointer-events-none" />
      )}
      {/* 地図グリッド背景 */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(0deg,rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* 検索バー */}
      <header className="w-full flex flex-col items-center pt-8 px-4 gap-2 relative z-[1000]">
        <div className="flex items-center gap-2 w-full max-w-md">
          <div className="flex items-center bg-[#ede7da] rounded-full px-4 py-2 shadow-md flex-1 border border-[#e4dccc]">
            <Search className="w-5 h-5 text-[#b8a78a] mr-2" />
            <input
              type="text"
              placeholder="場所やキーワードで検索"
              className="bg-transparent flex-1 outline-none text-[#7c6c57] placeholder-[#b1a086] font-light tracking-wide"
              style={{ fontFamily: "serif" }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = searchQuery.trim();
                  if (!q) return;
                  const found = photoList.find((p) => p.location.includes(q));
                  if (found) {
                    setSelectedPhoto(found);
                    if (mapRef.current) {
                      mapRef.current.setView([found.lat, found.lng], 9, {
                        animate: true,
                      });
                    }
                  } else {
                    alert("その場所の道草はまだ見つかりませんでした。");
                  }
                }
              }}
            />
          </div>
          <a
            href="/my-posts"
            className="bg-[#ede7da] hover:bg-[#e2d8c6] text-[#947962] rounded-full px-4 py-2 shadow-md border border-[#e4dccc] transition text-sm font-medium whitespace-nowrap"
          >
            自分の投稿
          </a>
        </div>
        <p className="w-full max-w-md text-center text-[#6f5237] text-base font-semibold tracking-wide mt-2">
          素敵な散歩道を思い出と共に教えて下さい
        </p>
        <p className="w-full max-w-md text-center text-[#8b7964] text-xs mt-1">
          あなたのアカウント名: <span className="font-semibold text-[#6b5742]">{userNickname || "あなた"}</span>
        </p>
        <form
          className="mt-3 w-full max-w-md mx-auto flex items-center gap-2 text-xs sm:text-sm text-[#6b5742]"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = nicknameInput.trim();
            if (!trimmed) return;
            setNickname(trimmed);
            setUserNickname(trimmed);
          }}
        >
          <label className="whitespace-nowrap" htmlFor="nickname-input">
            ニックネームを変更:
          </label>
          <input
            id="nickname-input"
            type="text"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            className="flex-1 rounded-md border border-[#d8c7ad] bg-white/80 px-3 py-2 text-[#5a3f25] placeholder:text-[#b09b80] focus:outline-none focus:ring-2 focus:ring-[#c9a887]"
            placeholder="例: 旅好き太郎"
          />
          <button
            type="submit"
            className="rounded-md bg-[#c9a887] px-3 py-2 text-white font-semibold shadow-sm hover:bg-[#b89676] border border-[#b48961] transition"
          >
            保存
          </button>
        </form>
      </header>
      {/* インタラクティブな日本地図 */}
      <section className="relative z-0 w-full h-[80vh] px-4 pb-6">
        <div className="w-full h-full max-w-4xl mx-auto rounded-[24px] overflow-hidden shadow-xl border border-[#e0d3bf] relative">
          {isPostSelecting && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] rounded-full bg-[#f8e6c9] text-[#5a3f25] text-sm sm:text-base font-semibold px-5 py-3 shadow-xl border border-[#e2b980] drop-shadow-lg">
              投稿したい場所をクリック — やめるときはもう一度「投稿」を押してください
            </div>
          )}
          {/* Leaflet が描画する本体 */}
          <div ref={mapContainerRef} className="w-full h-full" />
          {/* 最も人気の投稿の表彰バナー（地図枠内右上） */}
          {mostPopularPhoto && mostPopularPhoto.votes > 0 && (
            <div className="absolute top-3 right-3 z-[1200] pointer-events-none">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium pointer-events-auto">
                <Trophy className="w-4 h-4" />
                <span>
                  🏆 今日の人気No.1:{" "}
                  {mostPopularPhoto.title || mostPopularPhoto.location} (
                  {mostPopularPhoto.votes}いいね)
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* 投稿ボタン */}
      <div className="fixed bottom-24 right-7 z-[1500] max-w-xs">
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/95 px-4 py-3 text-xs text-indigo-700 shadow-md backdrop-blur-sm space-y-2">
          <p>
            このアプリづくりを応援したいと思ってもらえたら、
            <span className="font-semibold"> ofuse </span>
            でメッセージ付きで応援してもらえると、とても励みになります ✨
          </p>
          <a
            href={OFUSE_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-indigo-500 text-white px-3 py-1 hover:bg-indigo-600 transition text-xs font-medium"
          >
            ✨ ofuseで応援メッセージを送る
          </a>
        </div>
      </div>
      <button
        className="fixed bottom-7 right-7 bg-[#c9a887] hover:bg-[#b89676] text-white shadow-xl rounded-full px-6 py-3 flex items-center justify-center gap-2 border border-[#b48961] transition focus:outline-none z-[1500] min-w-[120px]"
        aria-label="投稿モードを切り替え"
        onClick={() => {
          setSelectedPhoto(null); // 既存の写真ビューは閉じる
          setIsPostOpen(false); // 投稿フォームは閉じておく
          setPendingLatLng(null); // 位置はこれから選ぶ
          setIsPostSelecting((prev) => !prev); // もう一度押すと解除
        }}
      >
        <Plus className="w-5 h-5" />
        <span className="text-sm font-semibold tracking-wide">投稿</span>
      </button>
      {/* Photo Detail Drawer */}
      <PhotoDetailDrawer
        photo={selectedPhoto}
        open={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        userId={userId}
        onDelete={async (photoId) => {
          const { error } = await supabase
            .from("photos")
            .delete()
            .eq("id", photoId)
            .eq("user_id", userId);

          if (error) {
            alert("削除に失敗しました: " + error.message);
            return;
          }

          setPhotoList((prev) => prev.filter((p) => p.id !== photoId));
          setSelectedPhoto(null);
          window.location.reload();
        }}
        onLike={async (photoId, currentLiked) => {
          if (currentLiked) {
            // いいねを削除
            const { error } = await supabase
              .from("likes")
              .delete()
              .eq("photo_id", photoId)
              .eq("user_id", userId);

            if (error) {
              console.error("いいね削除エラー:", error);
              return;
            }
          } else {
            // いいねを追加
            const { error } = await supabase
              .from("likes")
              .insert({ photo_id: photoId, user_id: userId });

            if (error) {
              console.error("いいね追加エラー:", error);
              return;
            }
          }

          // データを再読み込み
          window.location.reload();
        }}
      />
      {/* Post Drawer */}
      <PostDrawer
        open={isPostOpen}
        onClose={() => setIsPostOpen(false)}
        onSubmit={async (photo) => {
          setPhotoList((prev) => shuffleArray([...prev, photo]));
          setSelectedPhoto(photo);
          setIsPostOpen(false);
          setTodayPostCount((prev) => prev + 1);
          if (mapRef.current) {
            mapRef.current.setView([photo.lat, photo.lng], 9, {
              animate: true,
            });
          }
          // データを再読み込みして最新のいいね数などを取得
          window.location.reload();
        }}
        pendingLatLng={pendingLatLng}
        initialCenter={initialCenter}
        userId={userId}
        userNickname={userNickname}
        todayPostCount={todayPostCount}
      />
    </main>
  );
}

function PostDrawer({
  open,
  onClose,
  onSubmit,
  initialCenter,
  pendingLatLng,
  userId,
  userNickname,
  todayPostCount,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (photo: Photo) => void;
  initialCenter: [number, number];
  pendingLatLng: [number, number] | null;
  userId: string;
  userNickname: string;
  todayPostCount: number;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [episode, setEpisode] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(""); // URL入力はクリア
      // プレビュー用のURLを生成
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loc = location.trim();
    const ep = episode.trim();
    const tit = title.trim();

    if (!loc || !ep) {
      alert("場所とエピソードは必須です。");
      return;
    }

    // 1日3回制限チェック
    if (todayPostCount >= 3) {
      alert("1日の投稿上限（3回）に達しました。明日またお試しください。");
      return;
    }

    setUploading(true);

    const lat = pendingLatLng?.[0] ?? initialCenter[0];
    const lng = pendingLatLng?.[1] ?? initialCenter[1];

    let src =
      imageUrl.trim() ||
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80";

    // バケット名を確認してください（Supabase Storageで作成したバケット名に合わせてください）
    // 注意: Supabaseのバケット名は通常英数字とハイフンのみです
    // 「寄り道フォト」で作成した場合、実際のバケット名は異なる可能性があります
    const bucketName = "yorimichi-photo"; // 実際に作成したバケット名に変更してください

    // ファイルが選択されている場合はSupabase Storageにアップロード
    if (imageFile) {
      try {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${userId}_${Date.now()}.${fileExt}`;
        const filePath = `photos/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, imageFile);

        if (uploadError) {
          console.error("アップロードエラー:", uploadError);
          
          // Bucket not found エラーの場合
          if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("not found")) {
            alert(
              "Supabase Storage のバケットが見つかりません。\n\n" +
              "確認事項：\n" +
              "1. Storage でバケットが作成されているか確認\n" +
              "2. バケット名がコード内の設定と一致しているか確認\n" +
              "3. バケットが Public になっているか確認\n\n" +
              "それまで、写真URLを直接入力して投稿することもできます。"
            );
          } else {
            alert("写真のアップロードに失敗しました: " + uploadError.message + "\n\nURLを入力するか、再度お試しください。");
          }
          setUploading(false);
          return;
        }

        // 公開URLを取得
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        src = urlData.publicUrl;
      } catch (err: any) {
        console.error("アップロード処理エラー:", err);
        if (err?.message?.includes("Bucket not found") || err?.message?.includes("not found")) {
          alert(
            "Supabase Storage のバケットが見つかりません。\n\n" +
            "確認事項：\n" +
            "1. Storage でバケットが作成されているか確認\n" +
            "2. バケット名がコード内の設定と一致しているか確認\n" +
            "3. バケットが Public になっているか確認\n\n" +
            "それまで、写真URLを直接入力して投稿することもできます。"
          );
        } else {
          alert("写真のアップロードに失敗しました: " + (err?.message || "原因不明のエラー"));
        }
        setUploading(false);
        return;
      }
    }

    // Supabase に保存
    const { data, error } = await supabase
      .from("photos")
      .insert({
        image_url: src,
        location: loc,
        title: tit,
        episode: ep,
        author: userNickname || "あなた",
        user_id: userId,
        lat,
        lng,
        votes: 0,
      })
      .select("*")
      .single();

    if (error) {
      const msg = error?.message ?? "";
      if (msg.includes("Could not find the table 'public.photos'")) {
        alert(
          "Supabase の photos テーブルがまだ作成されていません。コンソールに出ている SQL を Supabase 側で実行してから、再度投稿してください。",
        );
      } else if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("rls")) {
        alert(
          "投稿が拒否されました。photos テーブルの RLS ポリシーが設定されていません。\n\n" +
          "Supabase SQL Editor で以下を実行してください：\n\n" +
          "CREATE POLICY \"Anyone can insert photos\" ON public.photos\n" +
          "FOR INSERT\n" +
          "WITH CHECK (true);\n\n" +
          "または、RLS を無効にする場合は：\n" +
          "ALTER TABLE public.photos DISABLE ROW LEVEL SECURITY;"
        );
      }
      console.error("Supabase への保存に失敗しました:", {
        message: msg || error,
        code: (error as any)?.code,
        details: (error as any)?.details,
      });
      alert(
        `投稿の保存に失敗しました: ${msg || "原因不明のエラー"}。\n時間をおいて再度お試しください。`,
      );
      return;
    }

    const newPhoto: Photo = {
      id: data.id,
      src: data.image_url,
      location: data.location,
      title: data.title || "",
      votes: 0,
      author: (data.author ?? userNickname) || "あなた",
      user_id: data.user_id || userId,
      episode: data.episode,
      lat: data.lat,
      lng: data.lng,
      isLiked: false,
    };

    onSubmit(newPhoto);
    setTitle("");
    setLocation("");
    setEpisode("");
    setImageUrl("");
    setImageFile(null);
    setImagePreview(null);
    setUploading(false);
  };

  return (
    <div
      className={classNames(
        "fixed inset-0 flex pointer-events-none z-[2100]",
        open ? "" : "invisible",
      )}
      aria-hidden={!open}
    >
      <div
        className={classNames(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0",
        )}
        aria-hidden
        onClick={onClose}
      />
      <div
        className={classNames(
          "pointer-events-auto transition-transform duration-500 ease-in-out w-full max-w-lg mx-auto left-0 right-0 fixed bottom-0 px-2 sm:px-0",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0",
        )}
        style={{
          transitionProperty: "transform,opacity",
        }}
      >
        <div className="rounded-t-2xl bg-[#f6f1e6] border-t-2 border-x-[1.5px] border-[#dbcab1] shadow-2xl mt-10 pb-7 max-h-[85vh] flex flex-col">
          <div className="flex-shrink-0 px-5 pt-7 pb-4 border-b border-[#dbcab1]">
            <h2 className="text-[#7a6047] text-lg font-semibold text-center">
              あなたの「道草」をそっと置いていく
            </h2>
            {todayPostCount >= 3 && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm text-center mt-3">
                ⚠️ 1日の投稿上限（3回）に達しました。明日またお試しください。
              </div>
            )}
            {todayPostCount < 3 && (
              <div className="text-xs text-[#aa9278] text-center mt-2">
                今日の投稿: {todayPostCount}/3回
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#8c745e]">
                  タイトル
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl border border-[#e0d4c3] bg-[#f9f4ea] px-3 py-2 text-[#6c5945] outline-none focus:ring-2 focus:ring-[#c6a98a]"
                  placeholder="この道草のタイトルを書いてください"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#8c745e]">
                  場所（例：長野県 木曽路）<span className="text-red-500">*</span>
                </label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="rounded-xl border border-[#e0d4c3] bg-[#f9f4ea] px-3 py-2 text-[#6c5945] outline-none focus:ring-2 focus:ring-[#c6a98a]"
                  placeholder="どこでの道草かを書いてください"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#8c745e]">
                  写真（任意）
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="rounded-xl border border-[#e0d4c3] bg-[#f9f4ea] px-3 py-2 text-[#6c5945] outline-none focus:ring-2 focus:ring-[#c6a98a] text-sm"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="プレビュー"
                      className="w-full max-w-xs mx-auto rounded-lg border border-[#e0d4c3] max-h-48 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-700"
                    >
                      写真を削除
                    </button>
                  </div>
                )}
                <div className="text-xs text-[#aa9278] mt-1">
                  または
                </div>
                <input
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    if (e.target.value) {
                      setImageFile(null);
                      setImagePreview(null);
                    }
                  }}
                  className="rounded-xl border border-[#e0d4c3] bg-[#f9f4ea] px-3 py-2 text-[#6c5945] outline-none focus:ring-2 focus:ring-[#c6a98a] text-sm"
                  placeholder="画像のURLを貼ることもできます"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#8c745e]">
                  そのときの小さなエピソード<span className="text-red-500">*</span>
                </label>
                <textarea
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                  rows={4}
                  className="rounded-xl border border-[#e0d4c3] bg-[#f9f4ea] px-3 py-2 text-[#6c5945] outline-none focus:ring-2 focus:ring-[#c6a98a] resize-none"
                  placeholder="風の匂い、音、ふと足を止めた理由など、自由に書いてみてください"
                  required
                />
              </div>
              <p className="text-xs text-[#aa9278] text-center">
                ※ 先ほどタップした場所に、あなたの道草ピンが置かれます
              </p>
              <div className="mt-4 mb-2 rounded-md bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
                <p className="mb-1">
                  このアプリづくりを応援したいと思ってもらえたら、
                  <span className="font-semibold"> ofuse </span>
                  でメッセージ付きで応援してもらえると、とても励みになります ✨
                </p>
                <a
                  href={OFUSE_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md bg-indigo-500 text-white px-3 py-1 hover:bg-indigo-600 transition text-xs font-medium"
                >
                  ✨ ofuseで応援メッセージを送る
                </a>
              </div>
              <button
                type="submit"
                disabled={todayPostCount >= 3 || uploading}
                className="mt-1 mx-auto inline-flex items-center justify-center rounded-full bg-[#c9a887] hover:bg-[#b89676] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-7 py-2.5 text-sm font-medium shadow-md transition"
              >
                {uploading ? "アップロード中..." : "この場所に道草を置く"}
              </button>
            </form>
          </div>
          <button
            className="absolute right-6 top-4 text-[#a18e7c] hover:text-[#8b795e] text-2xl font-bold transition focus:outline-none z-10"
            onClick={onClose}
            aria-label="閉じる"
            tabIndex={open ? 0 : -1}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoDetailDrawer({
  photo,
  open,
  onClose,
  userId,
  onDelete,
  onLike,
}: {
  photo: Photo | null;
  open: boolean;
  onClose: () => void;
  userId: string;
  onDelete: (photoId: number | string) => void;
  onLike: (photoId: number | string, currentLiked: boolean) => void;
}) {
  const isOwnPhoto = photo?.user_id === userId;

  return (
    <div
      className={classNames(
        "fixed inset-0 flex pointer-events-none z-[2000]",
        open ? "" : "invisible",
      )}
      aria-hidden={!open}
    >
      {/* モーダルの閉じる背景トーン */}
      <div
        className={classNames(
          "absolute inset-0 bg-black/10 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0",
        )}
        aria-hidden
        onClick={onClose}
      />
      {/* ドロワーカード */}
      <div
        className={classNames(
          "pointer-events-auto transition-transform duration-500 ease-in-out w-full max-w-lg mx-auto left-0 right-0 fixed bottom-0 px-2 sm:px-0",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0",
        )}
        style={{
          transitionProperty: "transform,opacity",
        }}
      >
        <div className="rounded-t-2xl bg-[#f6f1e6] border-t-2 border-x-[1.5px] border-[#dbcab1] shadow-2xl mt-10 pb-8">
          <div className="flex flex-col items-center p-4 pt-7">
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden border border-[#e8e0ce] shadow mb-5">
              {photo ? (
                <img
                  src={photo.src}
                  alt={photo.location}
                  className="object-cover w-full h-full"
                  draggable={false}
                />
              ) : null}
            </div>
            {photo?.title && (
              <h3 className="text-xl font-semibold text-[#7a6047] mb-2 text-center">
                {photo.title}
              </h3>
            )}
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-[#be9876]" />
              <span className="font-medium text-[#86664b] text-base">
                {photo?.location}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => {
                  if (photo) {
                    onLike(photo.id, photo.isLiked || false);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#ede7da] hover:bg-[#e2d8c6] transition"
              >
                <Heart
                  className={`w-5 h-5 ${
                    photo?.isLiked ? "text-red-500" : "text-[#be9876]"
                  }`}
                  fill={photo?.isLiked ? "currentColor" : "none"}
                />
                <span className="text-[#957c62] text-sm">{photo?.votes || 0}</span>
              </button>
              {isOwnPhoto && (
                <button
                  onClick={() => {
                    if (
                      photo &&
                      confirm("この投稿を削除しますか？この操作は取り消せません。")
                    ) {
                      onDelete(photo.id);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">削除</span>
                </button>
              )}
            </div>
            {/* エピソード */}
            <blockquote
              className="mt-4 text-[#726450] text-lg leading-relaxed text-center max-w-md px-2"
              style={{
                fontFamily:
                  `"BIZ Mincho", "游明朝", "Yu Mincho", "serif"`,
                fontWeight: 400,
                letterSpacing: ".02em",
              }}
            >
              {photo?.episode}
            </blockquote>
            <div className="mt-4 text-right w-full text-[#ab9682] text-sm font-serif pr-3">
              — {photo?.author}
            </div>
          </div>
          {/* 閉じるボタン */}
          <button
            className="absolute right-6 top-4 text-[#a18e7c] hover:text-[#8b795e] text-2xl font-bold transition focus:outline-none"
            onClick={onClose}
            aria-label="閉じる"
            tabIndex={open ? 0 : -1}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
