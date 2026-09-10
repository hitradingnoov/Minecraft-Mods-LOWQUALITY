// config.js
const BASE_URL = 'https://buxify.site';

module.exports = {
    PORT: process.env.PORT || 3000,
    supabase: {
        url: 'https://ciospbbjnzggkqsyoyeg.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpb3NwYmJqbnpnZ2txc3lveWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMTIwMTcsImV4cCI6MjEwNDU4ODAxN30.QjKjDvTXGvtEV2lZlGamwD0zzPUwakS1QaNmFYy81yQ'
    },
    google: {
        clientId: '235420484535-vd39irnfuk20jhg8n9jv3gqoaej2o3le.apps.googleusercontent.com',
        clientSecret: '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',
        callbackUrl: `${BASE_URL}/auth/google/callback`
    },
    roblox: {
        clientId: '4438582113529593979',
        clientSecret: 'RBX-V6hUjS0xEUKsnVvb3hMqO_f8NG1Da4Zuz68mA_1DWXbuw9WhSvxuEn5nxC0rcr2K',
        callbackUrl: `${BASE_URL}/auth/roblox/callback`
    },
    discord: {
        clientId: '1544421065860583434',
        clientSecret: 'qqFkE7CJMVWEhAfsejbaVqj04vY2xYUO',
        publicKey: '30efc312e5eb200d2ee6205d93cac8f442ef072b7297d86569fd9288e9bb88c6',
        callbackUrl: `${BASE_URL}/auth/discord/callback`
    }
};
