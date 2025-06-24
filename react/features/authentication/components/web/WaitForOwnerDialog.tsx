import React from "react";
import { WithTranslation } from "react-i18next";
import { connect } from "react-redux";

import { IStore } from "../../../app/types";
import { translate } from "../../../base/i18n/functions";
import Dialog from "../../../base/ui/components/web/Dialog";

/**
 * The type of the React {@code Component} props of {@link WaitForOwnerDialog}.
 */
interface IProps extends WithTranslation {
    /**
     * Redux store dispatch method.
     */
    dispatch: IStore["dispatch"];
}

/**
 * Component that renders the authentication expired dialog.
 *
 * @returns {React$Element<any>}
 */
class WaitForOwnerDialog extends React.Component<IProps> {
    /**
     * Called when the OK button is clicked.
     *
     * @private
     * @returns {void}
     */
    _onConfirm() {
        // Redirect to the specified URL
        window.location.href = 'https://bootcamp.glob-dev.kong.yk8s.me/404';
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    override render() {
        return (
            <Dialog
                ok={{
                    translationKey: "dialog.confirm",
                }}
                cancel={{
                    hidden: true,
                }}
                disableBackdropClose={true}
                hideCloseButton={true}
                onSubmit={this._onConfirm}
                titleKey="dialog.information"
            >
                인증이 만료되었습니다. 확인 후 다시 시도해주세요.
            </Dialog>
        );
    }
}

export default translate(connect()(WaitForOwnerDialog));
