from sqlmodel import SQLModel


def test_hot_path_indexes_are_present_in_model_metadata():
    expected = {
        "ix_course_course_uuid",
        "ix_resourceauthor_resource_uuid",
        "ix_course_tab_course_position",
        "ix_coursechapter_course_chapter",
        "ix_coursechapter_graph_course_chapter",
        "ix_chapteractivity_chapter_order",
        "ix_activity_course_id",
        "ix_usergroupresource_resource_group",
        "ix_usergroupuser_user_group",
    }
    actual = {
        index.name
        for table in SQLModel.metadata.tables.values()
        for index in table.indexes
    }

    assert expected <= actual
