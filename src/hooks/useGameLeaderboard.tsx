import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface LeaderboardEntry {
    user_id: string;
    username: string;
    avatar_url: string | null;
    score: number;
    rank: number;
}

export function useGameLeaderboard(gameId: string) {
    const { user } = useAuth();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            // STEP 1: Fetch top scores from token_transactions
            const { data: scoresData, error: scoresError } = await supabase
                .from('token_transactions')
                .select('amount, user_id') // Removed profile join to fix FK error
                .eq('activity_type', `game_score_${gameId}`)
                .order('amount', { ascending: false })
                .limit(20);

            if (scoresError) throw scoresError;

            if (scoresData && scoresData.length > 0) {
                // Group by user and take their best score
                const userBestScores: { [key: string]: number } = {};
                const userIds = new Set<string>();

                scoresData.forEach((tx: any) => {
                    if (!userBestScores[tx.user_id] || tx.amount > userBestScores[tx.user_id]) {
                        userBestScores[tx.user_id] = tx.amount;
                        userIds.add(tx.user_id);
                    }
                });

                // STEP 2: Fetch profiles for these users
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('user_id, username, avatar_url')
                    .in('user_id', Array.from(userIds));

                if (profilesError) throw profilesError;

                // Create a map for easy profile lookup
                const profileMap: { [key: string]: { username: string, avatar_url: string | null } } = {};
                profilesData?.forEach(p => {
                    profileMap[p.user_id] = {
                        username: p.username || 'Student',
                        avatar_url: p.avatar_url
                    };
                });

                // Combine scores and profiles
                const combinedLeaderboard: LeaderboardEntry[] = Object.entries(userBestScores)
                    .map(([userId, score]) => ({
                        user_id: userId,
                        username: profileMap[userId]?.username || 'Student',
                        avatar_url: profileMap[userId]?.avatar_url || null,
                        score: score,
                        rank: 0
                    }))
                    .sort((a, b) => b.score - a.score)
                    .map((entry, index) => ({ ...entry, rank: index + 1 }));

                setLeaderboard(combinedLeaderboard);
            } else {
                setLeaderboard([]);
            }
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            // Don't show toast error here to avoid spamming the user if table is empty
        } finally {
            setLoading(false);
        }
    }, [gameId]);

    const saveScore = useCallback(async (score: number) => {
        if (!user) return;

        try {
            // Log as a transaction with 0 tokens (using earnTokens logic)
            // But here we insert directly into token_transactions with type 'info' or similar if possible
            // Since token_transactions is strictly earn/spend in the hook, let's just use it
            // with a special activity_type and description.

            const { error } = await supabase
                .from('token_transactions')
                .insert({
                    user_id: user.id,
                    amount: score,
                    transaction_type: 'earn', // Using earn type but it's for score
                    activity_type: `game_score_${gameId}`,
                    description: `High score in ${gameId}`
                });

            if (error) throw error;
            fetchLeaderboard();
        } catch (error) {
            console.error('Error saving score:', error);
        }
    }, [user, gameId, fetchLeaderboard]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    return {
        leaderboard,
        loading,
        saveScore,
        refresh: fetchLeaderboard
    };
}
