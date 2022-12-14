const bcrypt = require("bcrypt");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

let refreshTokens = [];
const authController = {
    //Register
    registerUser : async(req,res) => {
        try{
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(req.body.password, salt);

            //Create new User
            const newUser = await new User({
                name: req.body.name,
                username: req.body.username,
                email: req.body.email,
                password: hashed,
                phone: req.body.phone,
                address: req.body.address,
                admin: req.body.admin,
            });

            //save to BD
            const user= await newUser.save();
            res.status(200).json(user);
        } catch(error){
            res.status(500).json(error);
        }
    },
    //Generate access token
    generateAccessToken: (user) => {
        return jwt.sign({
            id: user.id,
            admin: user.admin
        },
        process.env.JWT_ACCESS_KEY,
        {expiresIn: "300s"}
        );
    },
    //generate refresh token
    generateRefreshToken: (user) => {
        return jwt.sign({
            id: user.id,
            admin: user.admin
        },
        process.env.JWT_REFRESH_KEY,
        {expiresIn: "365d"}
        );
    },
    //LoGin
    loginUser : async(req,res) => {
        try{
            const user = await User.findOne({username: req.body.username});
            if(!user){
                res.status(404).json("Wrong Username!");
            }
            const validPassword = await bcrypt.compare(
                req.body.password,
                user.password
            );
            if(!validPassword) {
                res.status(404).json("Wrong password!");
            }
            if(user && validPassword){
                const accessToken = authController.generateAccessToken(user);
                const refreshToken = authController.generateRefreshToken(user);
                refreshTokens.push(refreshToken);
                res.cookie("refreshToken", refreshToken,{
                    httpOnly: true,
                    secure: false,
                    path:"/",
                    sameSite: "strict",
                });
                const {password, ...orthers} = user._doc;
                res.status(200).json({...orthers, accessToken});
            }
        }catch(error){
            res.status(500).json(error);
        }
    },

    requestRefreshToken: async(req, res) => {
        const refreshToken = req.cookies.refreshToken;
        if(!refreshToken) return res.status(401).json("You are not authenticated!");
        if(!refreshTokens.includes(refreshToken)) {
            return res.status(403).json("Refresh Token is not valid!");
        }
        jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (error,user)=>{
            if(error){
                console.log(error);
            }
            refreshTokens = refreshTokens.filter((token) => token !== refreshToken);
            const newAccessToken = authController.generateAccessToken(user);
            const newRefreshToken = authController.generateRefreshToken(user);
            refreshTokens.push(newRefreshToken);
            res.cookie("refreshToken", newRefreshToken,{
                httpOnly: true,
                secure: false,
                path:"/",
                sameSite: "strict",
            });
            res.status(200).json({ accessToken: newAccessToken });
        });
    },

    userLogout: async(req, res) => {
        res.clearCookie("refreshToken");
        refreshTokens = refreshTokens.filter(token => token !== req.cookies.refreshToken);
        res.status(200).json("Logged out successfully");
    }
};

module.exports = authController;