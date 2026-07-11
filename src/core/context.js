import { session } from "grammy";

export function createInitialSession() {
    return {
        step: "idle",
        active_film_id: null,
        active_film: null,
        active_episode: null,
        films: [],
        searchQuery: "",
        page: 1,
        totalPages: 1,
        subscription: {},
        admin: {
            verified: false,
            phoneNumber: null,
            userId: null,
            verifiedAt: null,
        },
    };
}

export const sessionMiddleware = session({ initial: createInitialSession });