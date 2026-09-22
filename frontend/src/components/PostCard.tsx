"use client";
import {useState} from "react";

interface PostCardProps {
    author: string;
    content: string;
    likes: number;
}

function PostCard({ author, content, likes }: PostCardProps) {
    const [likeCount, setLikeCount] = useState(likes);
    const [isLiked, setIsLiked] = useState(false);
    
    return (
        <div className="post">
            <h3>{author}</h3>
            <p>{content}</p>
            <button 
                onClick={() => {
                    if (!isLiked) {
                        setLikeCount((count) => count + 1);
                        setIsLiked(true);
                    }
                    else {
                        setLikeCount((count) => count - 1);
                        setIsLiked(false);
                    }
                }}
            >
                Likes: {likeCount}
            </button>
        </div>
    );
}

export default PostCard;