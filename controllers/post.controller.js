import ImageKit from 'imagekit';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';

export const getPosts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;

    const query = {};

    const cat = req.query.cat;
    const author = req.query.author;
    const searchQuery = req.query.search;
    const sortQuery = req.query.sort?.toLowerCase();
    const featured = req.query.featured;

    if (cat) {
        query.category = new RegExp(`^${cat}$`, 'i');
    }

    if (searchQuery) {
        query.title = { $regex: searchQuery, $options: 'i' };
    }

    if (author) {
        const user = await User.findOne({ username: author }).select('_id');

        if (!user) {
            return res.status(404).json('Not post found');
        }
        query.user = user._id;
    }

    let sortObj = { createdAt: -1 };

    if (sortQuery) {
        switch (sortQuery) {
            case 'newest':
                sortObj = { createdAt: -1 };
                break;
            case 'oldest':
                sortObj = { createdAt: 1 };
                break;
            case 'popular':
                sortObj = { visit: -1 };
                break;
            case 'trending':
                sortObj = { visit: -1 };
                query.createdAt = {
                    $gte: new Date(
                        new Date().getTime() - 7 * 24 * 60 * 60 * 1000
                    ),
                };
                break;
            default:
                break;
        }
    }

    if (featured) {
        query.isFeatured = true;
    }

    try {
        const posts = await Post.find(query)
            .populate('user', 'username')
            .sort(sortObj)
            .limit(limit)
            .skip((page - 1) * limit);

        const totalPosts = await Post.countDocuments(query);
        const hasMore = page * limit < totalPosts;

        res.status(200).json({ posts, hasMore });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch posts',
            details: error.message,
        });
    }
};

export const getPost = async (req, res) => {
    try {
        const post = await Post.findOne({ slug: req.params.slug }).populate(
            'user',
            'username img'
        );
        if (!post) {
            return res.status(404).json('Post not found');
        }
        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch post',
            details: error.message,
        });
    }
};

export const createPost = async (req, res) => {
    const clerkUserId = req.auth.userId;

    if (!clerkUserId) {
        return res.status(401).json('Not authorized');
    }

    const user = await User.findOne({ clerkUserId });

    if (!user) {
        return res.status(403).json('Unauthorized to create posts');
    }

    const slug = `${req.body.title
        .replace(/[!?.:;,]/g, '_')
        .replace(/ /g, '-')
        .toLowerCase()}-${new Date().getTime()}`;

    let existingPost = await Post.findOne({ slug });

    let counter = 1;

    while (existingPost) {
        slug = `${slug}-${counter}`;
        existingPost = await Post.findOne({ slug });
        counter++;
    }
    const newPost = new Post({ user: user._id, slug, ...req.body });

    try {
        const post = await newPost.save();
        res.status(200).json(post);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create post',
            details: error.message,
        });
    }
};

export const deletePost = async (req, res) => {
    const clerkUserId = req.auth.userId;

    if (!clerkUserId) {
        return res.status(401).json('Not authorized');
    }

    const role = req.auth.sessionClaims.metadata?.role || 'user';

    if (role === 'admin') {
        await Post.findByIdAndDelete(req.params.id);
        return res.status(200).json('Post has been deleted');
    }

    const user = await User.findOne({ clerkUserId });

    if (!user) {
        return res.status(403).json('Unauthorized to delete posts');
    }

    try {
        const deletedPost = await Post.findOneAndDelete({
            _id: req.params.id,
            user: user._id,
        });

        if (!deletedPost) {
            return res
                .status(403)
                .json({ error: 'Post not found or not authorized to delete' });
        }

        res.status(200).json('Post has been deleted');
    } catch (error) {
        res.status(500).json({
            error: 'Failed to delete post',
            details: error.message,
        });
    }
};

export const featurePost = async (req, res) => {
    const clerkUserId = req.auth.userId;
    const postId = req.body.postId;

    if (!clerkUserId) {
        return res.status(401).json('Not authorized');
    }

    const role = req.auth.sessionClaims.metadata?.role || 'user';

    if (role !== 'admin') {
        return res.status(403).json('You cannot feature posts!');
    }

    const post = await Post.findById(postId);

    if (!post) {
        return res.status(404).json('Post not found!');
    }

    const isFeatured = post.isFeatured;

    const updatedPost = await Post.findByIdAndUpdate(
        postId,
        {
            isFeatured: !isFeatured,
        },
        { new: true }
    );

    res.status(200).json(updatedPost);
};

const imagekit = new ImageKit({
    urlEndpoint: process.env.IK_URL_ENPOINT,
    publicKey: process.env.IK_PUBLIC_KEY,
    privateKey: process.env.IK_PRIVATE_KEY,
});

export const uploadAuth = async (req, res) => {
    try {
        const result = await imagekit.getAuthenticationParameters();
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to authenticate for upload',
            details: error.message,
        });
    }
};
