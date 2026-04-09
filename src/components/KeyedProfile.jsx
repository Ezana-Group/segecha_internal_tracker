import { useParams } from "react-router-dom";

/**
 * React Router reuses the same component instance when only :id changes.
 * That leaves local state (tabs, etc.) and can make headers look "stuck".
 * key={id} forces a remount so the profile always matches the URL.
 */
export function KeyedProfile({ as: Comp, ...props }) {
    const { id } = useParams();
    return <Comp key={id} {...props} />;
}
