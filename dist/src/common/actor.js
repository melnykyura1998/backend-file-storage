"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureActor = ensureActor;
async function ensureActor(prisma, actor) {
    const user = await prisma.user.findUnique({
        where: { id: actor.userId },
    });
    if (!user) {
        throw new Error('Authenticated user does not exist.');
    }
    return user;
}
//# sourceMappingURL=actor.js.map