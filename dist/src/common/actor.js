"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureActor = ensureActor;
const client_1 = require("@prisma/client");
async function ensureActor(prisma, actor) {
    if (!actor.isDemo) {
        const user = await prisma.user.findUnique({
            where: { id: actor.userId },
        });
        if (!user) {
            throw new Error('Authenticated user does not exist.');
        }
        return user;
    }
    const existingDemoUser = await prisma.user.findUnique({
        where: { email: actor.email },
    });
    if (existingDemoUser) {
        return existingDemoUser;
    }
    try {
        return await prisma.user.create({
            data: {
                email: actor.email,
                name: 'Demo User',
                passwordHash: 'demo-bypass',
            },
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            const createdByParallelRequest = await prisma.user.findUnique({
                where: { email: actor.email },
            });
            if (createdByParallelRequest) {
                return createdByParallelRequest;
            }
        }
        throw error;
    }
}
//# sourceMappingURL=actor.js.map