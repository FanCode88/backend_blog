import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import { Webhook } from 'svix';

export const clerkWebHook = async (req, res) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        return res.status(400).json({ message: 'Webhook secret needed!' });
    }

    const payload = req.body;
    const headers = req.headers;

    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;
    try {
        evt = wh.verify(payload, headers);
    } catch (err) {
        return res
            .status(400)
            .json({ message: 'Webhook verification failed!' });
    }

    try {
        if (evt.type === 'user.created') {
            const newUser = new User({
                clerkUserId: evt.data.id,
                username:
                    evt.data.username ||
                    evt.data.email_addresses[0].email_address,
                email: evt.data.email_addresses[0].email_address,
                img: evt.data.profile_img_url,
            });

            await newUser.save();
        }

        if (evt.type === 'user.deleted') {
            const deletedUser = await User.findOneAndDelete({
                clerkUserId: evt.data.id,
            });

            if (deletedUser) {
                await Post.deleteMany({ user: deletedUser._id });
                await Comment.deleteMany({ user: deletedUser._id });
            }
        }

        if (evt.type === 'user.updated') {
            const updatedUser = await User.findOne({
                clerkUserId: evt.data.id,
            });

            if (updatedUser) {
                updatedUser.username =
                    evt.data.username || updatedUser.username;
                updatedUser.email =
                    evt.data.email_addresses[0].email_address ||
                    updatedUser.email;
                updatedUser.img = evt.data.profile_img_url || updatedUser.img;

                await updatedUser.save();
            } else {
                return res
                    .status(404)
                    .json({ message: 'User not found for update' });
            }
        }

        return res.status(200).json({ message: 'Webhook received' });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return res
            .status(500)
            .json({ message: 'Internal server error', error });
    }
};
