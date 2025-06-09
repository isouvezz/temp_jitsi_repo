import React from "react";
import { WithTranslation } from "react-i18next";
import { connect } from "react-redux";

import { IStore } from "../../../app/types";
import { translate } from "../../../base/i18n/functions";
import Dialog from "../../../base/ui/components/web/Dialog";

/**
 * The type of the React {@code Component} props of {@link LeaveConferenceDialog}.
 */
interface IProps extends WithTranslation {
    /**
     * Redux store dispatch method.
     */
    dispatch: IStore["dispatch"];

    /**
     * Callback to be invoked when the dialog is confirmed.
     */
    onSubmit: () => void;
}

/**
 * Component that renders the leave conference dialog.
 *
 * @returns {React$Element<any>}
 */
class LeaveConferenceDialog extends React.Component<IProps> {
    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    override render() {
        const { t } = this.props;

        return (
            <Dialog ok={{ translationKey: "dialog.confirm" }} cancel={{}} titleKey="dialog.leaveConferenceTitle">
                <div>{t("dialog.leaveConferenceHostConfirm")}</div>
            </Dialog>
        );
    }
}

export default translate(connect()(LeaveConferenceDialog));
