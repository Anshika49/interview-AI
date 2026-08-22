const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const redisClient = require("../config/redis")

async function registerUserController(req,res){
    const{username,email,password} =req.body
    if(!username || !email || !password){
        return res.status(400).json({
            message:"please provide the deatails"
        })
    }
    const isUserAlreadyExists = await userModel.findOne({
        $or:[{username},{email}]
    })

    if(isUserAlreadyExists){
        return res.status(400).json({
            message:"acc already exist with this email or username"
        })
    }
    const hash = await bcrypt.hash(password,10)
    const user = await userModel.create({
        username,
        email,
        password:hash
    })
   const token = jwt.sign(
    {id:user._id,username:user.username},
    process.env.JWT_SECRET,
    {expiresIn:"1d"}
   )
  
//   res.cookie("token",token)
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
});
  res.status(201).json({
    message:"user registeres successfully",
    user:{
        id: user._id,
        username:user.username,
        email:user.email
    }
  })
}

async function loginUserController(req,res){
const {email,password} = req.body
const user = await userModel.findOne({email})
if(!user){
    return res.status(400).json({
        message:"Invalid email or password"
    })
}
const isPasswordValid = await bcrypt.compare(password,user.password)
if(!isPasswordValid){
    return res.status(400).json({
        message:"Invalid email or pass"
    })
}
const token = jwt.sign(
    {id:user._id,username:user.username},
    process.env.JWT_SECRET,
    {expiresIn:"1d"}
   )
res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
});
   res.status(200).json({
    message:"user loggedin successfully",
    user:{
        id:user._id,
        username:user.username,
        email:user.email
    }
   })

}

async function logoutUserController(req,res){
    const token = req.cookies.token
    if(token){
        try{
            const decoded = jwt.decode(token)
            const secondsRemaining = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0
            if(secondsRemaining > 0){
                await redisClient.set(`blacklist:${token}`, "1", "EX", secondsRemaining)
            }
        }catch(err){
            console.error("failed to blacklist token in redis:", err.message)
        }
    }
    res.clearCookie("token")
    res.status(200).json({
        message:"user logged out successfully"
    })
}

async function getMeController(req,res){
    const user = await userModel.findById(req.user.id)
    res.status(200).json({
        message:"user details fetched sucessfully",
        user:{
        id:user._id,
        username:user.username,
        email: user.email
        }
    })
}
module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
}