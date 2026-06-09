import { PostForm } from '../post-form';

export default function NewPostPage() {
  return (
    <div className="space-y-4">
      <h1 className="display-headline text-3xl text-gradient">新建文章</h1>
      <PostForm />
    </div>
  );
}
