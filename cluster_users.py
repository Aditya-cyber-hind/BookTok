import sqlite3
import json
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

DB = "booktok.db"

def get_user_features():
    conn = sqlite3.connect(DB)
    users = pd.read_sql_query("SELECT id, favourite_genres FROM users", conn)
    books = pd.read_sql_query("SELECT id, genre FROM books", conn)
    reading = pd.read_sql_query("SELECT user_id, book_id, status FROM reading_list", conn)
    reviews = pd.read_sql_query("SELECT user_id, rating FROM reviews", conn)
    conn.close()

    all_genres = books['genre'].unique()
    user_features = []

    for _, user in users.iterrows():
        uid = user['id']
        # Favourite genres (stored as JSON array)
        fav_genres = []
        try:
            fav_genres = json.loads(user['favourite_genres'])
        except:
            pass

        genre_vec = {g: 0.0 for g in all_genres}
        for g in fav_genres:
            if g in genre_vec:
                genre_vec[g] = 1.0   # binary flag

        # Number of finished books
        finished = reading[(reading['user_id'] == uid) & (reading['status'] == 'finished')]
        books_count = len(finished)

        # Average review rating given
        user_ratings = reviews[reviews['user_id'] == uid]
        avg_rating = user_ratings['rating'].mean() if not user_ratings.empty else 0.0

        feat = list(genre_vec.values()) + [books_count, avg_rating]
        user_features.append(feat)

    features_df = pd.DataFrame(user_features, columns=list(all_genres) + ['books_count', 'avg_rating'])
    return features_df, users

def cluster_users(k=10):
    X, users_df = get_user_features()
    if X.empty:
        return {}

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Use at most k clusters, but not more than number of users
    n_clusters = min(k, len(X))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(X_scaled)

    # The personality names – we'll create a big list and map cluster index to it
    all_names = [
        "📚 Fantasy Fanatics",        # 0
        "🥀 Dystopian Detectives",    # 1
        "💕 Romance Romantics",       # 2
        "📜 History Buffs",           # 3
        "🚀 Sci‑Fi Explorers",        # 4
        "🕵️ Mystery Lovers",          # 5
        "😱 Horror Enthusiasts",      # 6
        "🌈 Diverse Readers",         # 7
        "📊 Non‑Fiction Nerds",       # 8
        "🎭 Classics Connoisseurs"    # 9
    ]

    # Save cluster IDs to users table
    conn = sqlite3.connect(DB)
    try:
        conn.execute("ALTER TABLE users ADD COLUMN reader_cluster INTEGER DEFAULT -1")
    except:
        pass

    for i, uid in enumerate(users_df['id']):
        cluster_id = int(clusters[i])
        conn.execute("UPDATE users SET reader_cluster = ? WHERE id = ?", (cluster_id, int(uid)))
    conn.commit()
    conn.close()

    # Return mapping for reference (optional)
    return {int(uid): all_names[int(clusters[i])] for i, uid in enumerate(users_df['id'])}

if __name__ == "__main__":
    results = cluster_users(k=10)
    print(json.dumps(results, indent=2))