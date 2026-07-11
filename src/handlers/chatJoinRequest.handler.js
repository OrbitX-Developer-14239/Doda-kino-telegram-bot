import { pendingJoinRequests } from "../store/memory.store.js";

export async function handleChatJoinRequest(ctx) {
    try {
        pendingJoinRequests.add(`${ctx.chat.id}_${ctx.from.id}`)
    } catch (error) {
        console.error("Chat join request xatosi:", error.message)
    }
}
