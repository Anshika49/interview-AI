const jwt = require("jsonwebtoken")
const redisClient = require("../config/redis")

async function authUser(req,res,next){
    const token = req.cookies.token
    if(!token){
        return res.status(401).json({
            message:"token not provided"
        })
    }
    try{
        const isTokenBlacklisted = await redisClient.exists(`blacklist:${token}`)
        if(isTokenBlacklisted){
            return res.status(401).json({
                message:"token is invalid"
            })
        }
    }catch(err){
        console.error("redis blacklist check failed, failing open:", err.message)
    }

    try{
    const decoded = jwt.verify(token,process.env.JWT_SECRET)
    req.user = decoded
    next()

}catch(err){
    return res.status(401).json({
    message:"invalid token"
})
}
    }

    module.exports = {authUser}
   