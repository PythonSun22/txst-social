"use client";
import {useState} from "react";

interface PostCardProps {
    author: string;
    content: string;
    likes: number;
}

function PostCard({ author, content, likes }: PostCardProps) {
    const [likeCount, setLikeCount] = useState(likes);
    
    return (
        <div className="post">
            <h3>{author}</h3>
            <p>{content}</p>
            <p>Likes: {likes}</p>
        </div>
    );
}

export default PostCard;