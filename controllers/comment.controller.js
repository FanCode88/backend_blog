import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';

export const getPostComments = async (req, res) => {
    const comments = await Comment.find({ post: req.params.postId })
        .populate('user', 'username img')
        .sort({ createdAt: -1 });

    res.json(comments);
};

export const addComment = async (req, res) => {
    const clerkUserId = req.auth.userId;
    const postId = req.params.postId;

    if (!clerkUserId) {
        return res.status(401).json('Not authenticated');
    }

    const user = await User.findOne({ clerkUserId });
    if (!user) {
        return res.status(403).json('User does found');
    }

    const newComment = new Comment({
        ...req.body,
        user: user._id,
        post: postId,
    });

    const savedComment = await newComment.save();

    setTimeout(() => {
        res.status(201).json(savedComment);
    }, 3000);
};

export const deleteComment = async (req, res) => {
    const clerkUserId = req.auth.userId;
    const id = req.params.id;

    if (!clerkUserId) {
        return res.status(401).json('Not authenticated');
    }

    const role = req.auth.sessionClaims.metadata?.role || 'user';

    if (role === 'admin') {
        await Comment.findByIdAndDelete(req.params.id);
        return res.status(200).json('Comment has been deleted');
    }

    const user = await User.findOne({ clerkUserId });

    const deletedComment = await Comment.findOneAndDelete({
        _id: id,
        user: user._id,
    });

    if (!deletedComment) {
        return res.status(404).json('Comment not found');
    }

    res.status(200).json(deletedComment);
};
