import * as React from 'react';
import ProfileButton from './components/ProfileButton';
import ProfileModal from './components/ProfileModal';
import { useNavigate } from 'react-router-dom';
import { getProfile } from './api/api';
import type { UserProfile } from './api/types';
import axios from "axios";

const Profile: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/login');
        } else {
            const fetchProfileData = async () => {
                try {
                    const data = await getProfile();
                    setProfile(data);
                } catch (error) {
                    console.error('Failed to fetch profile in Profile:', error);
                    if (axios.isAxiosError(error) && error.response?.status === 401) {
                        localStorage.removeItem('token');
                        navigate('/login');
                    }
                }
            };
            fetchProfileData();
        }
    }, [navigate]);

    return (
        <>
            <ProfileButton onOpenModal={() => setIsModalOpen(true)} profile={profile} compact={compact} />
            <ProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                profile={profile}
                setProfile={setProfile}
            />
        </>
    );
};

export default Profile;