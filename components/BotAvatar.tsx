import { Avatar, AvatarImage } from "./ui/avatar"

interface BotAvatarProp {src: string}

const BotAvatar = ({src} :BotAvatarProp) => {
  return (
    <Avatar className="h-12 w-12">
        <AvatarImage src={src}/>

    </Avatar>
  )
}

export default BotAvatar